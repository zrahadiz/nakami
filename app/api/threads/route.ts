import { createClient } from '@/lib/supabase/server'
import { threadFromRow } from '@/lib/supabase/mappers'
import type { Thread } from '@/lib/types'

// GET /api/threads — all threads for the authenticated user, newest first.
// RLS scopes the query to the caller's rows.
export async function GET() {
  const supabase = await createClient()

  const { data: claimsData } = await supabase.auth.getClaims()
  const user = claimsData?.claims
  if (!user?.sub) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: rows, error } = await supabase
    .from('threads')
    .select()
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('GET /api/threads failed:', error)
    return Response.json({ error: 'Failed to load threads' }, { status: 500 })
  }

  const threads: Thread[] = rows.map(threadFromRow)
  return Response.json(threads)
}

// POST /api/threads — create a thread owned by the authenticated user.
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: claimsData } = await supabase.auth.getClaims()
  const user = claimsData?.claims
  if (!user?.sub) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { name, firstPrompt } = (body ?? {}) as {
    name?: unknown
    firstPrompt?: unknown
  }

  if (typeof name !== 'string' || name.trim() === '') {
    return Response.json({ error: 'name is required' }, { status: 400 })
  }
  if (firstPrompt !== undefined && typeof firstPrompt !== 'string') {
    return Response.json({ error: 'firstPrompt must be a string' }, { status: 400 })
  }

  const { data: row, error } = await supabase
    .from('threads')
    .insert({
      user_id: user.sub,
      name: name.trim(),
      first_prompt: firstPrompt ?? null,
    })
    .select()
    .single()

  if (error) {
    console.error('POST /api/threads failed:', error)
    return Response.json({ error: 'Failed to create thread' }, { status: 500 })
  }

  const thread: Thread = threadFromRow(row)
  return Response.json(thread, { status: 201 })
}
