import { createClient } from '@/lib/supabase/server'
import { threadFromRow } from '@/lib/supabase/mappers'
import type { Thread } from '@/lib/types'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET /api/threads/[id] — one thread, 404 unless it belongs to the caller.
// RLS makes a thread owned by someone else indistinguishable from a missing one.
export async function GET(_request: Request, ctx: RouteContext<'/api/threads/[id]'>) {
  const supabase = await createClient()

  const { data: claimsData } = await supabase.auth.getClaims()
  const user = claimsData?.claims
  if (!user?.sub) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await ctx.params
  if (!UUID_RE.test(id)) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: row, error } = await supabase
    .from('threads')
    .select()
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error(`GET /api/threads/${id} failed:`, error)
    return Response.json({ error: 'Failed to load thread' }, { status: 500 })
  }
  if (!row) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const thread: Thread = threadFromRow(row)
  return Response.json(thread)
}
