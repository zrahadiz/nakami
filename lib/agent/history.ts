import type { ChatMessage } from '@/lib/types'
import type { Tables } from '@/lib/supabase/database.types'

export interface HistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

// Stored messages -> model history. Text parts pass through; completed plans
// are handed back as JSON so the agent keeps context across turns. Tool calls
// are UI-only and stay out of the model history.
export function toModelMessages(
  rows: Array<Tables<'messages'>>
): HistoryMessage[] {
  return rows.map((row) => {
    const parts = Array.isArray(row.parts)
      ? (row.parts as unknown as ChatMessage['parts'])
      : []
    const content = parts
      .map((part) => {
        if (part.type === 'text') return part.text
        if (part.type === 'structured-output') return JSON.stringify(part.data)
        return null
      })
      .filter((text): text is string => Boolean(text))
      .join('\n\n')
    return {
      role: row.role === 'assistant' ? 'assistant' : 'user',
      content,
    }
  })
}
