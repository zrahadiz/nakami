import { createHash } from 'node:crypto'
import { FAL_MODELS, type FalModelKind } from '@/lib/fal/models'

// T5: content-addressed identity of a generated asset. The model ID is part of
// the key, so switching models invalidates old cache entries instead of
// silently reusing them. Prompts are normalized (case + whitespace) so trivial
// formatting differences still hit the cache.
//
// The dev mock picks its canned sample from the prompt, so mock image-to-3D
// jobs include the prompt in the key too. Real fal image-to-3D depends only on
// the image URL.
export function computeCacheKey(
  kind: FalModelKind,
  source: { imageUrl?: string | null; prompt?: string | null },
  options: { includePrompt?: boolean } = {}
): string {
  const modelId = FAL_MODELS[kind].id
  let normalized: string

  if (kind === 'image-to-3d') {
    const imageUrl = (source.imageUrl ?? '').trim()
    const prompt = options.includePrompt
      ? (source.prompt ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
      : ''
    normalized = prompt ? `${imageUrl}\n${prompt}` : imageUrl
  } else {
    normalized = (source.prompt ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
  }

  return createHash('sha256')
    .update(`${modelId}\n${kind}\n${normalized}`)
    .digest('hex')
}
