// T4: fal.ai model registry — endpoints and pure mapping helpers.
//
// Model choice (verify against https://fal.ai/models before changing any ID
// or input shape — fal schemas evolve):
// - image-to-3D: fal-ai/trellis   — single image -> GLB. Input: { image_url }.
// - text-to-3D:  fal-ai/hyper3d/rodin — prompt -> GLB. Input: { prompt, ... }.
// Both return `model_mesh.url` pointing at a generated GLB file.

export const JOB_KINDS = ['image-to-3d', 'text-to-3d'] as const
export type FalModelKind = (typeof JOB_KINDS)[number]

export interface FalModel {
  id: string
  kind: FalModelKind
  label: string
}

export const FAL_MODELS: Record<FalModelKind, FalModel> = {
  'image-to-3d': { id: 'fal-ai/trellis', kind: 'image-to-3d', label: 'Trellis' },
  'text-to-3d': { id: 'fal-ai/hyper3d/rodin', kind: 'text-to-3d', label: 'Hyper3D Rodin' },
}

/** Normalized generation result; fal's own response shape never leaks out. */
export interface Fal3DResult {
  glbUrl: string
  thumbnailUrl?: string
  seed?: number
}

/** Internal job status union used by the worker and the jobs API. */
export type FalQueueStatus = 'queued' | 'running' | 'ready' | 'failed'

export function buildImageTo3DInput(imageUrl: string): { image_url: string } {
  return { image_url: imageUrl }
}

export function buildTextTo3DInput(prompt: string): {
  prompt: string
  geometry_file_format: 'glb'
} {
  return { prompt, geometry_file_format: 'glb' }
}

/** fal queue status (`IN_QUEUE`, `IN_PROGRESS`, `COMPLETED`) -> our union. */
export function mapFalQueueStatus(status: unknown): FalQueueStatus {
  switch (status) {
    case 'IN_QUEUE':
      return 'queued'
    case 'IN_PROGRESS':
      return 'running'
    case 'COMPLETED':
      return 'ready'
    default:
      return 'failed'
  }
}

/**
 * Map a fal result payload to the normalized result. Both registered models
 * return `model_mesh.url`; Rodin additionally returns `seed` and `textures`.
 * Returns null when the payload has no usable mesh URL.
 */
export function mapModelMeshOutput(data: unknown): Fal3DResult | null {
  if (typeof data !== 'object' || data === null) return null

  const mesh = (data as { model_mesh?: unknown }).model_mesh
  if (typeof mesh !== 'object' || mesh === null) return null

  const url = (mesh as { url?: unknown }).url
  if (typeof url !== 'string' || url === '') return null

  const result: Fal3DResult = { glbUrl: url }

  const seed = (data as { seed?: unknown }).seed
  if (typeof seed === 'number') result.seed = seed

  const textures = (data as { textures?: unknown }).textures
  if (Array.isArray(textures)) {
    const first = textures[0] as { url?: unknown } | undefined
    if (first && typeof first.url === 'string' && first.url !== '') {
      result.thumbnailUrl = first.url
    }
  }

  return result
}
