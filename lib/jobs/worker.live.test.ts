import { describe, expect, mock, test } from 'bun:test'

// LIVE test: runs against the real Supabase project and exercises the whole
// job pipeline with the fal mock driver — submit -> poll -> download a seeded
// sample -> upload glb-cache/{cache_key}.glb -> assets row -> job ready.
// It creates and removes its own rows/objects, so it is safe to re-run.
//
// Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and the seeded
// samples (`bun run seed:samples`). Plain `bun test` skips it; run:
//   bun run test:live
mock.module('server-only', () => ({}))
const { createServiceClient } = await import('@/lib/supabase/service')
const { computeCacheKey } = await import('@/lib/jobs/cache-key')
const { runJob } = await import('@/lib/jobs/worker')

// Force the mock driver so this never spends real fal.ai credits, and resolve
// polls instantly.
process.env.FAL_MOCK = '1'
process.env.FAL_MOCK_DELAY_MS = '0'

const hasLiveEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
)

describe('jobs pipeline (live)', () => {
  test.skipIf(!hasLiveEnv)(
    'runs end to end and cleans up after itself',
    async () => {
      const supabase = createServiceClient()

      const { data: users } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 })
      const userId = users?.users[0]?.id
      expect(userId).toBeTruthy()

      const { data: thread, error: threadError } = await supabase
        .from('threads')
        .insert({ user_id: userId!, name: 'e2e smoke (temporary)' })
        .select()
        .single()
      expect(threadError).toBeNull()

      const imageUrl = 'https://placehold.co/600x400?text=Tan+Leather+Armchair'
      const cacheKey = computeCacheKey('image-to-3d', { imageUrl })

      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .insert({
          user_id: userId!,
          thread_id: thread!.id,
          kind: 'image-to-3d',
          status: 'queued',
          cache_key: cacheKey,
          input_url: imageUrl,
          product_id: 'e2e-product',
        })
        .select()
        .single()
      expect(jobError).toBeNull()

      await runJob(job!.id)

      const { data: finished } = await supabase
        .from('jobs')
        .select()
        .eq('id', job!.id)
        .single()
      expect(finished?.status).toBe('ready')
      expect(finished?.asset_url).toContain(`/glb-cache/${cacheKey}.glb`)
      expect(finished?.error).toBeNull()

      const { data: asset } = await supabase
        .from('assets')
        .select()
        .eq('cache_key', cacheKey)
        .maybeSingle()
      expect(asset?.storage_path).toBe(`${cacheKey}.glb`)

      // The exact bytes the UI will load: the armchair keyword resolves to the
      // chair sample, cached under the content-addressed key.
      const download = await fetch(finished!.asset_url!)
      expect(download.ok).toBe(true)
      const bytes = new Uint8Array(await download.arrayBuffer())
      expect(Buffer.from(bytes.subarray(0, 4)).toString('ascii')).toBe('glTF')
      const { data: sampleArmchair } = await supabase.storage
        .from('glb-cache')
        .download('samples/chairModernCushion.glb')
      expect(bytes.byteLength).toBe(await sampleArmchair!.size)
      console.log(`[live] job ${job!.id} ready; artifact ${bytes.byteLength} bytes`)

      // Cleanup: remove the generated artifact + asset row + thread (cascades job).
      await supabase.storage.from('glb-cache').remove([`${cacheKey}.glb`])
      await supabase.from('assets').delete().eq('cache_key', cacheKey)
      await supabase.from('threads').delete().eq('id', thread!.id)

      const { count } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('id', job!.id)
      expect(count).toBe(0)
    },
    30_000
  )
})
