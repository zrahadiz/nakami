import { describe, expect, test } from 'bun:test'
import {
  FAL_MODELS,
  JOB_KINDS,
  buildImageTo3DInput,
  buildTextTo3DInput,
  mapFalQueueStatus,
  mapModelMeshOutput,
} from './models'

describe('fal model registry', () => {
  test('every job kind has a registered model', () => {
    for (const kind of JOB_KINDS) {
      const model = FAL_MODELS[kind]
      expect(model.kind).toBe(kind)
      expect(model.id).toMatch(/^fal-ai\//)
    }
  })

  test('buildImageTo3DInput matches the Trellis schema', () => {
    expect(buildImageTo3DInput('https://example.com/chair.png')).toEqual({
      image_url: 'https://example.com/chair.png',
    })
  })

  test('buildTextTo3DInput pins GLB output for Rodin', () => {
    expect(buildTextTo3DInput('a walnut sideboard')).toEqual({
      prompt: 'a walnut sideboard',
      geometry_file_format: 'glb',
    })
  })
})

describe('mapFalQueueStatus', () => {
  test('maps the fal queue lifecycle onto our union', () => {
    expect(mapFalQueueStatus('IN_QUEUE')).toBe('queued')
    expect(mapFalQueueStatus('IN_PROGRESS')).toBe('running')
    expect(mapFalQueueStatus('COMPLETED')).toBe('ready')
  })

  test('unknown or failed statuses map to failed', () => {
    expect(mapFalQueueStatus('FAILED')).toBe('failed')
    expect(mapFalQueueStatus(undefined)).toBe('failed')
    expect(mapFalQueueStatus(42)).toBe('failed')
  })
})

describe('mapModelMeshOutput', () => {
  test('maps a Trellis-style payload to the GLB URL', () => {
    expect(
      mapModelMeshOutput({ model_mesh: { url: 'https://fal.media/chair.glb' } })
    ).toEqual({ glbUrl: 'https://fal.media/chair.glb' })
  })

  test('maps a Rodin-style payload with seed and texture thumbnail', () => {
    expect(
      mapModelMeshOutput({
        model_mesh: { url: 'https://fal.media/sofa.glb' },
        seed: 1234,
        textures: [{ url: 'https://fal.media/sofa.png' }],
      })
    ).toEqual({
      glbUrl: 'https://fal.media/sofa.glb',
      seed: 1234,
      thumbnailUrl: 'https://fal.media/sofa.png',
    })
  })

  test('returns null when there is no usable mesh URL', () => {
    expect(mapModelMeshOutput(null)).toBeNull()
    expect(mapModelMeshOutput('not an object')).toBeNull()
    expect(mapModelMeshOutput({})).toBeNull()
    expect(mapModelMeshOutput({ model_mesh: {} })).toBeNull()
    expect(mapModelMeshOutput({ model_mesh: { url: '' } })).toBeNull()
  })
})
