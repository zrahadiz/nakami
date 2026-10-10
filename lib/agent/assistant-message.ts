import type { StreamChunk } from '@tanstack/ai'
import type { AgentPlan, ChatMessage } from '@/lib/types'

export interface AssistantMessageDraft {
  role: 'assistant'
  parts: ChatMessage['parts']
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

/**
 * Wraps the chat() stream: assembles the assistant message from the AG-UI
 * events (text deltas, tool calls with their results, the structured-output
 * plan) and calls `persist` exactly once, when the terminal
 * `structured-output.complete` event arrives.
 *
 * `persist` errors are logged and swallowed so a failed DB write can never
 * break the SSE stream. Every chunk is yielded unchanged.
 */
export async function* withAssistantPersistence(
  stream: AsyncIterable<StreamChunk>,
  persist: (message: AssistantMessageDraft) => Promise<void>
): AsyncGenerator<StreamChunk> {
  const parts: ChatMessage['parts'] = []
  const textPartByMessageId = new Map<string, number>()
  const toolCallByCallId = new Map<string, { partIndex: number; args: string }>()
  // Message ids whose TEXT_MESSAGE_CONTENT deltas are structured-output JSON,
  // not assistant prose. Announced by `structured-output.start`.
  const structuredMessageIds = new Set<string>()
  let persisted = false

  for await (const chunk of stream) {
    switch (chunk.type) {
      case 'TEXT_MESSAGE_CONTENT':
        if (chunk.delta && !structuredMessageIds.has(chunk.messageId)) {
          let index = textPartByMessageId.get(chunk.messageId)
          if (index === undefined) {
            index = parts.push({ type: 'text', text: '' }) - 1
            textPartByMessageId.set(chunk.messageId, index)
          }
          const part = parts[index]
          if (part.type === 'text') part.text += chunk.delta
        }
        break

      case 'TOOL_CALL_START':
        toolCallByCallId.set(chunk.toolCallId, {
          partIndex:
            parts.push({
              type: 'tool-call',
              toolName: chunk.toolCallName,
              args: {},
            }) - 1,
          args: '',
        })
        break

      case 'TOOL_CALL_ARGS': {
        const call = toolCallByCallId.get(chunk.toolCallId)
        if (call) call.args += chunk.delta
        break
      }

      case 'TOOL_CALL_END': {
        const call = toolCallByCallId.get(chunk.toolCallId)
        if (call) {
          const part = parts[call.partIndex]
          if (part.type === 'tool-call') part.args = tryParseJson(call.args)
        }
        break
      }

      case 'TOOL_CALL_RESULT': {
        const call = toolCallByCallId.get(chunk.toolCallId)
        const part = call ? parts[call.partIndex] : undefined
        if (part?.type === 'tool-call') {
          part.result =
            typeof chunk.content === 'string'
              ? tryParseJson(chunk.content)
              : chunk.content
        }
        break
      }

      case 'CUSTOM':
        if (chunk.name === 'structured-output.start') {
          const value = chunk.value as { messageId?: string } | undefined
          if (value?.messageId) structuredMessageIds.add(value.messageId)
        }
        if (chunk.name === 'structured-output.complete' && !persisted) {
          const value = chunk.value as { object?: unknown } | undefined
          if (value?.object !== undefined) {
            parts.push({
              type: 'structured-output',
              data: value.object as AgentPlan,
              status: 'complete',
            })
          }
          persisted = true
          try {
            await persist({ role: 'assistant', parts })
          } catch (err) {
            console.error('Failed to persist assistant message:', err)
          }
        }
        break
    }

    yield chunk
  }
}
