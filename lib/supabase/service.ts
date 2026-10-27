import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

/**
 * Server-only Supabase client that authenticates as the service role.
 *
 * - Bypasses RLS: never import this module from a client component or anything
 *   that ships to the browser. The `server-only` import turns an accidental
 *   client-side import into a build error.
 * - No cookie dependency: unlike lib/supabase/server.ts, this client is not
 *   bound to the request's session, so it is safe to use inside `after()`
 *   callbacks, webhooks, and background workers.
 * - Mirrors lib/supabase/server.ts: create a fresh client per call instead of a
 *   module-level singleton (Fluid compute keeps instances alive across runs).
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'createServiceClient: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set'
    )
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
