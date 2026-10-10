import type { Tables } from './database.types'
import type { Thread } from '@/lib/types'

type ThreadRow = Tables<'threads'>

// Database row (snake_case) -> API contract type (camelCase).
export function threadFromRow(row: ThreadRow): Thread {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    firstPrompt: row.first_prompt,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
