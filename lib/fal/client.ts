import 'server-only'
import { fal } from '@fal-ai/client'
import {
  FAL_MODELS,
  buildImageTo3DInput,
  buildTextTo3DInput,
  mapFalQueueStatus,
  mapModelMeshOutput,
  type Fal3DResult,
  type FalModelKind,
  type FalQueueStatus,
} from './models'
import { isFalMockEnabled, pollMockJob, submitMockJob } from './mock'

// T4: fal.ai client wrapper. Server-only module: reads FAL_KEY. Never import
// from client components. Mirrors lib/channel3.ts — external types are
// normalized here and never leak past this module.
//
// When the dev mock driver is enabled (lib/fal/mock.ts), submissions and polls
// are served from local sample models instead of fal.ai — the worker cannot
// tell the difference.

/** Pacing for the job worker (T5). */
export const FAL_POLL_INTERVAL_MS = 3_000
export const FAL_POLL_TIMEOUT_MS = 240_000

export interface FalJobHandle {
  kind: FalModelKind
  modelId: string
  requestId: string
}

export interface FalJobSnapshot {
  status: FalQueueStatus
  result?: Fal3DResult
  error?: string
}

function configureFal(): void {
  const credentials = process.env.FAL_KEY
  if (!credentials) {
    throw new Error('FAL_KEY is not configured')
  }
  // Idempotent: fal.config only stores credentials for the client.
  fal.config({ credentials })
}

async function submit(
  kind: FalModelKind,
  input: Record<string, unknown>,
  sourceHint?: string,
): Promise<FalJobHandle> {
  const model = FAL_MODELS[kind]

  if (isFalMockEnabled()) {
    // The mock uses the hint (product name) to pick a semantically matching
    // sample. It is never sent to fal for real image-to-3D generation.
    const source =
      kind === 'image-to-3d'
        ? String(sourceHint || input.image_url || '')
        : String(input.prompt ?? '')
    return submitMockJob(kind, model.id, source)
  }

  configureFal()
  const queued = await fal.queue.submit(model.id, { input })
  return { kind, modelId: model.id, requestId: queued.request_id }
}

/**
 * Queue an image-to-3D generation (Trellis). `sourceHint` (the product name) is
 * only used by the dev mock to choose a matching sample.
 */
export async function generateImageTo3D(
  imageUrl: string,
  sourceHint?: string,
): Promise<FalJobHandle> {
  return submit('image-to-3d', buildImageTo3DInput(imageUrl), sourceHint)
}

/** Queue a text-to-3D generation (Hyper3D Rodin). Returns the fal request handle. */
export async function generateTextTo3D(prompt: string): Promise<FalJobHandle> {
  return submit('text-to-3d', buildTextTo3DInput(prompt))
}

/**
 * Poll one fal request. Resolves to a normalized snapshot; when the queue
 * status is COMPLETED the result is fetched and normalized too. Failures
 * (network, unknown request, malformed result) resolve to `failed` so the
 * worker can mark the job without special-casing.
 */
export async function pollJob(handle: FalJobHandle): Promise<FalJobSnapshot> {
  if (isFalMockEnabled()) return pollMockJob(handle)

  configureFal()

  try {
    const status = await fal.queue.status(handle.modelId, {
      requestId: handle.requestId,
    })
    const mapped = mapFalQueueStatus(status.status)

    if (mapped !== 'ready') {
      return { status: mapped }
    }

    const { data } = await fal.queue.result(handle.modelId, {
      requestId: handle.requestId,
    })
    const result = mapModelMeshOutput(data)
    if (!result) {
      return { status: 'failed', error: 'fal result did not include a mesh URL' }
    }
    return { status: 'ready', result }
  } catch (err) {
    return {
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
