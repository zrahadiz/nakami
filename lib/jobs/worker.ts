import 'server-only'
import {
  FAL_POLL_INTERVAL_MS,
  FAL_POLL_TIMEOUT_MS,
  generateImageTo3D,
  generateTextTo3D,
  pollJob,
  type FalJobHandle,
} from '@/lib/fal/client'
import { FAL_MODELS, JOB_KINDS, type FalModelKind } from '@/lib/fal/models'
import { createServiceClient } from '@/lib/supabase/service'
import type { Tables } from '@/lib/supabase/database.types'

// T5: background job pipeline. Submits a job to fal, polls until it completes,
// downloads the GLB into the glb-cache bucket, upserts the content-addressed
// asset row, and marks the job ready. Runs inside `after()` from the jobs API
// route, so it must stay idempotent: any invocation may race with the GET
// sweep re-advancing a stale job.

const GLB_BUCKET = 'glb-cache'

/** A queued/running job older than this is re-advanced by the GET sweep. */
export const STALE_JOB_MS = 5 * 60 * 1000

type ServiceClient = ReturnType<typeof createServiceClient>
type JobRow = Tables<'jobs'>
type FalResult = NonNullable<Awaited<ReturnType<typeof pollJob>>['result']>

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function isJobKind(value: string): value is FalModelKind {
  return (JOB_KINDS as readonly string[]).includes(value)
}

export async function runJob(jobId: string): Promise<void> {
  const supabase = createServiceClient()

  const { data: job, error } = await supabase
    .from('jobs')
    .select()
    .eq('id', jobId)
    .maybeSingle()
  if (error) {
    console.error(`runJob ${jobId}: failed to load job`, error)
    return
  }
  if (!job) {
    console.error(`runJob ${jobId}: job not found`)
    return
  }
  // Idempotency guard: a raced invocation may already have finished the job.
  if (job.status === 'ready' || job.status === 'failed') return
  if (!isJobKind(job.kind)) {
    await failJob(supabase, job, `unknown job kind: ${job.kind}`)
    return
  }

  try {
    const handle = job.fal_request_id
      ? { kind: job.kind, modelId: FAL_MODELS[job.kind].id, requestId: job.fal_request_id }
      : await submitJob(supabase, job)
    if (!handle) return

    const deadline = Date.now() + FAL_POLL_TIMEOUT_MS
    while (Date.now() < deadline) {
      const snapshot = await pollJob(handle)
      if (snapshot.status === 'ready' && snapshot.result) {
        await finalizeJob(supabase, job, handle.modelId, snapshot.result)
        return
      }
      if (snapshot.status === 'failed') {
        await failJob(supabase, job, snapshot.error ?? 'generation failed')
        return
      }
      await sleep(FAL_POLL_INTERVAL_MS)
    }
    // Still running at the deadline: leave the job running. fal keeps working
    // in the background and the GET sweep re-advances stale jobs later.
    console.warn(`runJob ${jobId}: poll window elapsed; leaving job running for the sweep`)
  } catch (err) {
    await failJob(supabase, job, err instanceof Error ? err.message : String(err))
  }
}

/** Submit the job to fal (first invocation) and record the request handle. */
async function submitJob(supabase: ServiceClient, job: JobRow): Promise<FalJobHandle | null> {
  try {
    const handle =
      job.kind === 'image-to-3d'
        ? await generateImageTo3D(job.input_url ?? '')
        : await generateTextTo3D(job.input_prompt ?? '')

    const { error } = await supabase
      .from('jobs')
      .update({
        status: 'running',
        fal_request_id: handle.requestId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id)
    if (error) throw error

    return handle
  } catch (err) {
    await failJob(supabase, job, err instanceof Error ? err.message : String(err))
    return null
  }
}

/** Download the generated GLB, cache it in Storage, and mark the job ready. */
async function finalizeJob(
  supabase: ServiceClient,
  job: JobRow,
  modelId: string,
  result: FalResult
): Promise<void> {
  const download = await fetch(result.glbUrl)
  if (!download.ok) {
    throw new Error(`GLB download failed (HTTP ${download.status}) for ${result.glbUrl}`)
  }
  const bytes = await download.arrayBuffer()
  const storagePath = `${job.cache_key}.glb`

  const upload = await supabase.storage.from(GLB_BUCKET).upload(storagePath, bytes, {
    upsert: true,
    contentType: 'model/gltf-binary',
  })
  if (upload.error) throw upload.error

  // Content-addressed cache: the first row for a cache key wins (it may belong
  // to another user). Insert only when missing; re-select when a race lost.
  let assetId: string | null = null
  const inserted = await supabase
    .from('assets')
    .upsert(
      {
        user_id: job.user_id,
        cache_key: job.cache_key,
        model_id: modelId,
        storage_path: storagePath,
        file_size_bytes: bytes.byteLength,
      },
      { onConflict: 'cache_key', ignoreDuplicates: true }
    )
    .select()
    .maybeSingle()
  if (inserted.error) throw inserted.error
  assetId = inserted.data?.id ?? null

  if (!assetId) {
    const existing = await supabase
      .from('assets')
      .select('id')
      .eq('cache_key', job.cache_key)
      .maybeSingle()
    if (existing.error) throw existing.error
    assetId = existing.data?.id ?? null
  }

  const publicUrl = supabase.storage.from(GLB_BUCKET).getPublicUrl(storagePath).data.publicUrl
  const { error } = await supabase
    .from('jobs')
    .update({
      status: 'ready',
      asset_id: assetId,
      asset_url: publicUrl,
      error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id)
  if (error) throw error
}

async function failJob(supabase: ServiceClient, job: JobRow, message: string): Promise<void> {
  console.error(`job ${job.id} failed: ${message}`)
  const { error } = await supabase
    .from('jobs')
    .update({
      status: 'failed',
      error: message,
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id)
  if (error) {
    console.error(`job ${job.id}: failed to persist failure state`, error)
  }
}
