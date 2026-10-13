// components/workspace/nakami-connection.ts
//
// Connects TanStack AI's useChat to your existing POST /api/chat route WITHOUT changing it.
//
// useChat sends an AG-UI payload ({ messages, threadId, runId, forwardedProps, ... }),
// but your route expects { threadId, message }. This wrapper rewrites the request body:
//   - threadId  -> the thread from the page URL
//   - message   -> forwardedProps.message (what we pass to sendMessage), or the last user message
//   - locked / category -> forwarded as extra fields (your route can ignore or use them)
//
// Cookies (Supabase session) are sent automatically because it's a same-origin request.

import { fetchServerSentEvents } from '@tanstack/ai-react'

type Loose = Record<string, unknown>

const isObj = (v: unknown): v is Loose =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

function lastUserText(messages: unknown): string | undefined {
  if (!Array.isArray(messages)) return undefined

  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (!isObj(m) || m.role !== 'user') continue

    if (typeof m.content === 'string' && m.content.trim()) return m.content

    const parts = Array.isArray(m.parts)
      ? m.parts
      : Array.isArray(m.content)
        ? m.content
        : []
    const text = parts
      .map((p) =>
        isObj(p) && typeof p.content === 'string'
          ? p.content
          : isObj(p) && typeof p.text === 'string'
            ? p.text
            : ''
      )
      .join('')
      .trim()
    if (text) return text
  }
  return undefined
}

export function createNakamiConnection(threadId: string) {
  const nakamiFetch: typeof fetch = async (input, init) => {
    try {
      if (typeof init?.body === 'string') {
        const payload: unknown = JSON.parse(init.body)

        if (isObj(payload)) {
          const forwarded = isObj(payload.forwardedProps) ? payload.forwardedProps : {}
          const message =
            typeof forwarded.message === 'string' && forwarded.message.trim()
              ? forwarded.message
              : lastUserText(payload.messages)

          if (message) {
            return fetch(input, {
              ...init,
              body: JSON.stringify({
                threadId,
                message,
                category: forwarded.category,
                locked: forwarded.locked,
              }),
            })
          }
        }
      }
    } catch {
      /* fall through and send the original request */
    }

    return fetch(input, init)
  }

  return fetchServerSentEvents('/api/chat', { fetchClient: nakamiFetch })
}