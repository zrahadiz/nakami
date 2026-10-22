import type { Tables } from './database.types'
import type { GenerationJob, Thread } from '@/lib/types'

type ThreadRow = Tables<'threads'>
type JobRow = Tables<'jobs'>

// Database row (snake_case) -> API contract type (camelCase).
export function threadFromRow(row: ThreadRow): Thread {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    firstPrompt: row.first_prompt,
    category: row.category as Thread['category'],
    previewImageUrl: row.preview_image_url ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// The DB check constraints keep `kind`/`status` inside the unions (T5).
export function jobFromRow(row: JobRow): GenerationJob {
  return {
    id: row.id,
    userId: row.user_id,
    threadId: row.thread_id,
    kind: row.kind as GenerationJob['kind'],
    status: row.status as GenerationJob['status'],
    cacheKey: row.cache_key,
    productId: row.product_id,
    inputUrl: row.input_url,
    inputPrompt: row.input_prompt,
    falRequestId: row.fal_request_id,
    assetId: row.asset_id,
    assetUrl: row.asset_url,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
