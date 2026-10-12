import { afterEach, describe, expect, mock, test } from 'bun:test'

// `server-only` exists to fail Next.js client bundles; under `bun test` there is
// no React Server Component bundler, so stub it before importing the module.
mock.module('server-only', () => ({}))
const { createServiceClient } = await import('./service')

const hasServiceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

afterEach(() => {
  if (originalServiceKey === undefined) {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
  } else {
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey
  }
})

// T1 smoke test: with SUPABASE_SERVICE_ROLE_KEY set, the service client must be
// able to read/write without a user session (RLS bypassed by design). The write
// half uses a throwaway `assets` row and deletes it again.
// Plain `bun test` skips it; run: bun run test:live
describe('createServiceClient', () => {
  test.skipIf(!hasServiceKey)(
    'reads and writes a throwaway row without a session',
    async () => {
      const supabase = createServiceClient()

      // Admin API is service-role only — a good no-session server check.
      const { data: users, error: usersError } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1,
      })
      expect(usersError).toBeNull()

      const userId = users?.users[0]?.id
      if (!userId) {
        // Fresh project with no users: nothing to anchor the row to.
        return
      }

      const cacheKey = `smoke-${crypto.randomUUID()}`
      const { error: insertError } = await supabase.from('assets').insert({
        user_id: userId,
        cache_key: cacheKey,
        model_id: 'smoke-test',
        storage_path: `${cacheKey}.glb`,
      })
      expect(insertError).toBeNull()

      const { data: readBack, error: readError } = await supabase
        .from('assets')
        .select()
        .eq('cache_key', cacheKey)
        .maybeSingle()
      expect(readError).toBeNull()
      expect(readBack?.cache_key).toBe(cacheKey)

      const { error: deleteError } = await supabase
        .from('assets')
        .delete()
        .eq('cache_key', cacheKey)
      expect(deleteError).toBeNull()
    }
  )

  test('throws a descriptive error when the key is missing', () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    expect(() => createServiceClient()).toThrow('SUPABASE_SERVICE_ROLE_KEY')
  })
})
