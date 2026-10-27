-- T11: pinned preview image for the thread workspace. The Preview tab captures
-- the 3D scene (canvas.toDataURL), uploads the image to the thread-thumbnails
-- bucket through /api/threads/[id]/preview-image, and this column stores the
-- pinned URL so the Products tab corner (and thread lists) can show it.
-- RLS already scopes threads per user; the column is written by the server
-- route through the service role only.

alter table public.threads
  add column preview_image_url text;

-- Thread lists read the pinned image alongside the thread row.
grant select on table public.threads to authenticated;
