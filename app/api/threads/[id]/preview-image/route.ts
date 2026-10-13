import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// canvas.toDataURL('image/jpeg') — keep the upload tiny and typed.
const DATA_URL_RE = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/
/** ~4 MB of binary — the client sends a downscaled JPEG (~100 KB). */
const MAX_BASE64_LENGTH = 5_600_000

// POST /api/threads/[id]/preview-image — pin a captured 3D preview.
// The client captures the SceneCanvas as a JPEG data URL; this route validates
// the thread ownership (RLS), uploads the image to the public
// thread-thumbnails bucket via the service role, and stores the URL on
// threads.preview_image_url.
export async function POST(
  request: Request,
  ctx: RouteContext<'/api/threads/[id]/preview-image'>
) {
  const supabase = await createClient()

  const { data: claimsData } = await supabase.auth.getClaims()
  const user = claimsData?.claims
  if (!user?.sub) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await ctx.params
  if (!UUID_RE.test(id)) {
    return Response.json({ error: 'Thread not found' }, { status: 404 })
  }

  // RLS scopes this query: a thread owned by someone else looks missing.
  const { data: thread } = await supabase
    .from('threads')
    .select('id')
    .eq('id', id)
    .maybeSingle()
  if (!thread) {
    return Response.json({ error: 'Thread not found' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const dataUrl =
    typeof (body as { dataUrl?: unknown })?.dataUrl === 'string'
      ? ((body as { dataUrl: string }).dataUrl as string)
      : ''
  const match = DATA_URL_RE.exec(dataUrl)
  if (!match) {
    return Response.json(
      { error: 'dataUrl must be a base64 JPEG image data URL' },
      { status: 400 }
    )
  }
  if (match[1].length > MAX_BASE64_LENGTH) {
    return Response.json({ error: 'Preview image is too large' }, { status: 413 })
  }

  const bytes = Buffer.from(match[1], 'base64')

  const service = createServiceClient()
  const storagePath = `${id}/preview.jpeg`
  const upload = await service.storage
    .from('thread-thumbnails')
    .upload(storagePath, bytes, { upsert: true, contentType: 'image/jpeg' })
  if (upload.error) {
    console.error('preview-image upload failed:', upload.error)
    return Response.json({ error: 'Failed to upload preview' }, { status: 500 })
  }

  // `v` breaks the browser cache of the bucket's public URL, which is stable
  // across pins because the storage path is per-thread.
  const publicUrl = `${service.storage
    .from('thread-thumbnails')
    .getPublicUrl(storagePath).data.publicUrl}?v=${Date.now()}`

  const { error } = await service
    .from('threads')
    .update({ preview_image_url: publicUrl })
    .eq('id', id)
  if (error) {
    console.error('preview-image thread update failed:', error)
    return Response.json({ error: 'Failed to pin preview' }, { status: 500 })
  }

  return Response.json({ url: publicUrl })
}

// DELETE /api/threads/[id]/preview-image — clear the pinned preview. Storage
// cleanup is best-effort; clearing the column is what makes it disappear.
export async function DELETE(
  _request: Request,
  ctx: RouteContext<'/api/threads/[id]/preview-image'>
) {
  const supabase = await createClient()

  const { data: claimsData } = await supabase.auth.getClaims()
  const user = claimsData?.claims
  if (!user?.sub) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await ctx.params
  if (!UUID_RE.test(id)) {
    return Response.json({ error: 'Thread not found' }, { status: 404 })
  }

  // RLS scopes this query: a thread owned by someone else looks missing.
  const { data: thread } = await supabase
    .from('threads')
    .select('id')
    .eq('id', id)
    .maybeSingle()
  if (!thread) {
    return Response.json({ error: 'Thread not found' }, { status: 404 })
  }

  const service = createServiceClient()
  const removed = await service.storage
    .from('thread-thumbnails')
    .remove([`${id}/preview.jpeg`])
  if (removed.error) {
    console.error('preview-image remove failed:', removed.error)
  }

  const { error } = await service
    .from('threads')
    .update({ preview_image_url: null })
    .eq('id', id)
  if (error) {
    console.error('preview-image thread update failed:', error)
    return Response.json({ error: 'Failed to unpin preview' }, { status: 500 })
  }

  return new Response(null, { status: 204 })
}
