import 'server-only'
import { createHash } from 'node:crypto'
import type { FalJobHandle, FalJobSnapshot } from './client'
import type { FalModelKind } from './models'

// T4 dev tooling: a fake fal.ai driver so the whole job pipeline — jobs route,
// worker, glb-cache upload, Realtime — can be exercised without FAL_KEY or
// real generation cost. The real client in ./client.ts picks this driver when
// isFalMockEnabled() is true, and nothing downstream changes.
//
// Sample models (Kenney, CC0 — public/models/) are seeded into the glb-cache
// Storage bucket under samples/ once via `bun run seed:samples`. Mock results
// resolve to those public Storage URLs, i.e. the same shape as a real fal
// result URL, so the worker's download/upload path is identical in both modes.
//
// Enabled when NODE_ENV !== 'production' AND either:
//   - FAL_MOCK=1 (force), or
//   - FAL_MOCK is unset and FAL_KEY is missing (zero-config local dev).
// FAL_MOCK=0 disables it. Production never mocks.

const DEFAULT_TOTAL_MS = 6_000
/** Fraction of the total delay spent in `queued` before `running`. */
const QUEUED_PORTION = 0.4

/** requestId -> submission timestamp; the poll status timeline reads this. */
const submittedAt = new Map<string, number>()
let warned = false

export function isFalMockEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false
  const flag = process.env.FAL_MOCK?.trim()
  if (flag === '0' || flag === 'false') return false
  if (flag === '1' || flag === 'true') return true
  // Not explicitly configured: mock only when there is no real key.
  return !process.env.FAL_KEY
}

function totalDelayMs(): number {
  const raw = Number(process.env.FAL_MOCK_DELAY_MS)
  if (Number.isFinite(raw) && raw >= 0) return raw
  return DEFAULT_TOTAL_MS
}

interface MockSample {
  file: string
  keywords: string[]
}

// Kenney "Furniture Kit" samples (CC0) — see public/models/README.md.
const SAMPLES: MockSample[] = [
  { file: 'tableCoffee.glb', keywords: ['coffee table'] },
  { file: 'sideTable.glb', keywords: ['side table', 'nightstand'] },
  { file: 'table.glb', keywords: ['dining table', 'desk', 'table'] },
  { file: 'lampRoundTable.glb', keywords: ['table lamp'] },
  { file: 'lampRoundFloor.glb', keywords: ['floor lamp', 'lamp'] },
  { file: 'lampSquareCeiling.glb', keywords: ['pendant', 'ceiling lamp'] },
  { file: 'loungeSofa.glb', keywords: ['sofa', 'couch', 'loveseat'] },
  { file: 'loungeDesignChair.glb', keywords: ['accent chair', 'lounge chair'] },
  { file: 'chairModernCushion.glb', keywords: ['armchair', 'chair'] },
  { file: 'rugRectangle.glb', keywords: ['rug'] },
  { file: 'bookcaseOpen.glb', keywords: ['bookshelf', 'bookcase', 'shelf'] },
  { file: 'cabinetTelevision.glb', keywords: ['sideboard', 'cabinet', 'console'] },
  { file: 'pottedPlant.glb', keywords: ['plant', 'vase', 'flower'] },
  { file: 'bathroomMirror.glb', keywords: ['mirror'] },
  { file: 'books.glb', keywords: ['books', 'art'] },
]

function hashSource(source: string): string {
  return createHash('sha256').update(source).digest('hex')
}

/**
 * Deterministic sample index for a generation source: a keyword in the source
 * (product title, prompt, or image URL text) wins — longest keyword first — and
 * anything unrecognized falls back to a stable hash.
 */
export function resolveMockSampleIndex(source: string): number {
  const haystack = source.toLowerCase()
  let bestIndex = -1
  let bestLength = 0
  for (let index = 0; index < SAMPLES.length; index++) {
    for (const keyword of SAMPLES[index].keywords) {
      if (haystack.includes(keyword) && keyword.length > bestLength) {
        bestLength = keyword.length
        bestIndex = index
      }
    }
  }
  if (bestIndex >= 0) return bestIndex
  return parseInt(hashSource(source).slice(0, 8), 16) % SAMPLES.length
}

/** Sample file the mock will resolve for this source (exported for tests). */
export function resolveMockSampleFile(source: string): string {
  return SAMPLES[resolveMockSampleIndex(source)].file
}

/**
 * Public Storage URL of a seeded sample — the same shape as a real fal result
 * URL, so the worker's download path is identical in both modes. Seed the
 * samples once with `bun run seed:samples`.
 */
export function buildMockGlbUrl(file: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!baseUrl) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL is required for mock generations (the samples live in the glb-cache bucket)'
    )
  }
  return `${baseUrl}/storage/v1/object/public/glb-cache/samples/${file}`
}

/** Queue a fake generation. The sample index is encoded in the request id so
 *  polls stay deterministic even if the stale-job reaper runs in a new process. */
export function submitMockJob(kind: FalModelKind, modelId: string, source: string): FalJobHandle {
  const hash = hashSource(`${modelId}\n${kind}\n${source}`)
  const sampleIndex = resolveMockSampleIndex(source)
  const requestId = `mock-${hash.slice(0, 16)}-${String(sampleIndex).padStart(2, '0')}`
  submittedAt.set(requestId, Date.now())

  if (!warned) {
    warned = true
    console.warn(
      '[fal-mock] Serving fake 3D generations from glb-cache/samples (seed once: bun run seed:samples). Set FAL_MOCK=0 and FAL_KEY for real fal.ai.'
    )
  }
  return { kind, modelId, requestId }
}

function sampleIndexFromRequestId(requestId: string): number {
  const match = /-(\d{2})$/.exec(requestId)
  const index = match ? Number.parseInt(match[1], 10) : Number.NaN
  if (Number.isInteger(index) && index >= 0 && index < SAMPLES.length) return index
  return parseInt(hashSource(requestId).slice(0, 8), 16) % SAMPLES.length
}

export function pollMockJob(handle: FalJobHandle): FalJobSnapshot {
  // A re-advanced job (stale sweep in a new process) has no timestamp: it is
  // old by definition, so it resolves immediately.
  const started = submittedAt.get(handle.requestId)
  const elapsed = started === undefined ? Number.POSITIVE_INFINITY : Date.now() - started
  const total = totalDelayMs()

  if (elapsed < total * QUEUED_PORTION) return { status: 'queued' }
  if (elapsed < total) return { status: 'running' }

  const sample = SAMPLES[sampleIndexFromRequestId(handle.requestId)]
  try {
    const seed = parseInt(hashSource(handle.requestId).slice(0, 8), 16) % 65536
    const snapshot: FalJobSnapshot = {
      status: 'ready',
      result: { glbUrl: buildMockGlbUrl(sample.file), seed },
    }
    submittedAt.delete(handle.requestId)
    return snapshot
  } catch (err) {
    submittedAt.delete(handle.requestId)
    return {
      status: 'failed',
      error: `mock sample unavailable (${sample.file}): ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}
