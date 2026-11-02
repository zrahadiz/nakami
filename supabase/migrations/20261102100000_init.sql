-- Baseline schema (2026-11-02). Squashes the earlier incremental migrations:
--   threads + messages (with chat persistence snapshot and category)
--   generation jobs + content-addressed assets
--   3D storage buckets and public-read policies
--   PayPal multi-seller checkout (retailer-keyed merchant mapping)
--   pinned thread preview image
--
-- Create a fresh project with `bun run db:migrate`.

-- ---------------------------------------------------------------------------
-- Threads + messages
-- ---------------------------------------------------------------------------

create table public.threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  first_prompt text,
  category text not null default 'furniture'
    check (category in ('furniture', 'gaming')),
  preview_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index threads_user_id_updated_at_idx on public.threads (user_id, updated_at desc);

-- One row per thread: the whole chat transcript is a JSON snapshot, aligned
-- with what /api/chat persists (`messages_json`).
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  messages_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index messages_thread_id_created_at_idx on public.messages (thread_id, created_at);
create index messages_user_id_idx on public.messages (user_id);

-- The chat persistence upsert targets thread_id.
create unique index messages_thread_id_key on public.messages (thread_id);

alter table public.threads enable row level security;
alter table public.messages enable row level security;

create policy "users_select_own_threads" on public.threads
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "users_insert_own_threads" on public.threads
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "users_update_own_threads" on public.threads
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "users_delete_own_threads" on public.threads
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "users_select_own_messages" on public.messages
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.threads
      where threads.id = messages.thread_id
        and threads.user_id = (select auth.uid())
    )
  );

create policy "users_insert_own_messages" on public.messages
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.threads
      where threads.id = messages.thread_id
        and threads.user_id = (select auth.uid())
    )
  );

-- UPDATE is required by the chat persistence upsert
-- (INSERT ... ON CONFLICT DO UPDATE).
create policy "users_update_own_messages" on public.messages
  for update to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.threads
      where threads.id = messages.thread_id
        and threads.user_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.threads
      where threads.id = messages.thread_id
        and threads.user_id = (select auth.uid())
    )
  );

grant select, insert, update, delete on table public.threads to authenticated;
grant select, insert, update on table public.messages to authenticated;
grant all on table public.threads to service_role;
grant all on table public.messages to service_role;

-- ---------------------------------------------------------------------------
-- Generation jobs + content-addressed assets
-- ---------------------------------------------------------------------------

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cache_key text not null unique,
  model_id text not null,
  storage_path text not null,
  file_size_bytes bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index assets_user_id_idx on public.assets (user_id);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid not null references public.threads(id) on delete cascade,
  kind text not null check (kind in ('image-to-3d', 'text-to-3d')),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'ready', 'failed')),
  cache_key text not null,
  product_id text,
  input_url text,
  input_prompt text,
  fal_request_id text,
  asset_id uuid references public.assets(id) on delete set null,
  asset_url text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index jobs_thread_id_created_at_idx on public.jobs (thread_id, created_at);
create index jobs_user_id_idx on public.jobs (user_id);
create index jobs_asset_id_idx on public.jobs (asset_id);
-- Stale-job sweep: only queued/running rows are ever scanned by the reaper.
create index jobs_active_updated_at_idx on public.jobs (updated_at)
  where status in ('queued', 'running');

alter table public.assets enable row level security;
alter table public.jobs enable row level security;

-- Users can read their own rows; writes happen through the service role in the
-- job worker, so authenticated gets select only.
create policy "users_select_own_assets" on public.assets
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "users_select_own_jobs" on public.jobs
  for select to authenticated
  using ((select auth.uid()) = user_id);

grant select on table public.assets to authenticated;
grant select on table public.jobs to authenticated;
grant all on table public.assets to service_role;
grant all on table public.jobs to service_role;

-- Realtime: the Preview tab subscribes to job status changes for its thread.
-- RLS applies to postgres_changes, so the select policy above scopes delivery.
alter publication supabase_realtime add table public.jobs;

-- ---------------------------------------------------------------------------
-- Storage buckets for the 3D pipeline
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- PayPal multi-seller checkout
-- ---------------------------------------------------------------------------

-- Merchant mappings are keyed by RETAILER: every product from the same store
-- pays the same PayPal business account ("payee"). Global config data, not
-- user data: RLS is enabled with no policies so only the service role
-- (bypasses RLS) can read it. Environment-scoped so sandbox and live
-- assignments do not collide.
create table public.paypal_merchants (
  retailer          text not null,
  payee_email       text not null,
  payee_merchant_id text not null,
  env               text not null default 'sandbox',
  created_at        timestamptz not null default now(),
  primary key (retailer, env)
);

alter table public.paypal_merchants enable row level security;

-- No authenticated/anon grants: the mapping is server configuration.
grant all on table public.paypal_merchants to service_role;

create table public.orders (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  thread_id          uuid references public.threads(id) on delete set null,
  status             text not null default 'created' check (status in (
                       'created', 'approved', 'completed', 'partially_completed',
                       'failed', 'canceled')),
  currency           text not null default 'USD',
  total_amount       numeric(10,2) not null check (total_amount > 0),
  paypal_order_id    text unique,
  paypal_payer_id    text,
  paypal_payer_email text,
  error              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index orders_user_id_created_at_idx on public.orders (user_id, created_at desc);
create index orders_thread_id_idx on public.orders (thread_id);

alter table public.orders enable row level security;

-- Read-only for users; the server writes through the service role, so there are
-- intentionally no insert/update/delete policies.
create policy "users_select_own_orders" on public.orders
  for select to authenticated
  using ((select auth.uid()) = user_id);

grant select on table public.orders to authenticated;
grant all on table public.orders to service_role;

create table public.order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  product_id        text not null,
  slot              text,
  title             text not null,
  retailer          text not null,
  unit_price        numeric(10,2) not null check (unit_price > 0),
  quantity          int not null default 1 check (quantity >= 1),
  purchase_ref      text not null,   -- == purchase_units[].reference_id
  payee_email       text not null,
  payee_merchant_id text not null,
  paypal_capture_id text,
  capture_status    text check (capture_status in (
                      'COMPLETED', 'DECLINED', 'PENDING', 'VOIDED',
                      'PARTIALLY_COMPLETED')),
  net_amount        numeric(10,2),
  created_at        timestamptz not null default now(),
  unique (order_id, purchase_ref)
);

create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_product_id_idx on public.order_items (product_id);

alter table public.order_items enable row level security;

create policy "users_select_own_order_items" on public.order_items
  for select to authenticated
  using ((select auth.uid()) = user_id);

grant select on table public.order_items to authenticated;
grant all on table public.order_items to service_role;
