-- T2: Storage buckets for the 3D pipeline.
-- product-images: cached product imagery (public read) so the browser and fal
--   get stable, CORS-friendly URLs.
-- glb-cache: generated GLB files keyed by cache_key (public read).
-- thread-thumbnails: scene captures for the thread list and preview corner.

insert into storage.buckets (id, name, public)
values
  ('product-images', 'product-images', true),
  ('glb-cache', 'glb-cache', true),
  ('thread-thumbnails', 'thread-thumbnails', true)
on conflict (id) do nothing;

-- Public read policies: public URLs bypass RLS, but the Storage API (list,
-- authenticated download) still needs a select policy.
create policy "product_images_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'product-images');

create policy "glb_cache_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'glb-cache');

create policy "thread_thumbnails_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'thread-thumbnails');

-- No insert/update/delete policies: uploads run through the service role
-- (bypasses RLS) from server routes and the job worker only.
