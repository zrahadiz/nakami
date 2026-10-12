import { createHash } from 'node:crypto'
import { FAL_MODELS, type FalModelKind } from '@/lib/fal/models'

// T5: content-addressed identity of a generated asset. The model ID is part of
// the key, so switching models invalidates old cache entries instead of
// silently reusing them. Prompts are normalized (case + whitespace) so trivial
// formatting differences still hit the cache.
export function computeCacheKey(
  kind: FalModelKind,
  source: { imageUrl?: string | null; prompt?: string | null }
): string {
  const modelId = FAL_MODELS[kind].id
  const normalized =
    kind === 'image-to-3d'
      ? (source.imageUrl ?? '').trim()
      : (source.prompt ?? '').trim().replace(/\s+/g, ' ').toLowerCase()

  return createHash('sha256')
    .update(`${modelId}\n${kind}\n${normalized}`)
    .digest('hex')
}
