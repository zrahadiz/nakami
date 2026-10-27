import { describe, expect, test } from 'bun:test'
import { computeCacheKey } from './cache-key'

describe('computeCacheKey', () => {
  test('is stable for the same input', () => {
    const a = computeCacheKey('image-to-3d', { imageUrl: 'https://x.test/chair.png' })
    const b = computeCacheKey('image-to-3d', { imageUrl: 'https://x.test/chair.png' })
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })

  test('normalizes prompt whitespace and case', () => {
    const a = computeCacheKey('text-to-3d', { prompt: 'Walnut   Sideboard' })
    const b = computeCacheKey('text-to-3d', { prompt: 'walnut sideboard' })
    expect(a).toBe(b)
  })

  test('changes when the image URL, kind, or prompt changes', () => {
    const base = computeCacheKey('image-to-3d', { imageUrl: 'https://x.test/a.png' })
    expect(computeCacheKey('image-to-3d', { imageUrl: 'https://x.test/b.png' })).not.toBe(base)
    expect(computeCacheKey('text-to-3d', { prompt: 'a table' })).not.toBe(
      computeCacheKey('text-to-3d', { prompt: 'a chair' })
    )
  })

  test('includes the mock prompt hint only when requested', () => {
    const imageUrl = 'https://x.test/shared.png'
    const rug = computeCacheKey(
      'image-to-3d',
      { imageUrl, prompt: 'Rug' },
      { includePrompt: true }
    )
    const chair = computeCacheKey(
      'image-to-3d',
      { imageUrl, prompt: 'Chair' },
      { includePrompt: true }
    )
    expect(rug).not.toBe(chair)

    // Real fal image-to-3D ignores the prompt, so the cache stays image-only.
    expect(computeCacheKey('image-to-3d', { imageUrl, prompt: 'Rug' })).toBe(
      computeCacheKey('image-to-3d', { imageUrl, prompt: 'Chair' })
    )
  })
})
