-- T2: generation jobs + content-addressed 3D assets for the Week 2 pipeline.
-- jobs: one row per 3D generation request (image-to-3D or text-to-3D), owned by
-- the requesting user and scoped to a thread so the UI can restore state.
-- assets: content-addressed cache of generated GLBs, keyed by cache_key.

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
  status text not null default 'queued' check (status in ('queued', 'running', 'ready', 'failed')),
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
create index jobs_active_updated_at_idx on public.jobs (updated_at) where status in ('queued', 'running');

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

-- Data API grants: RLS decides which rows are visible.
grant select on table public.assets to authenticated;
grant select on table public.jobs to authenticated;
grant all on table public.assets to service_role;
grant all on table public.jobs to service_role;

-- Realtime: the Preview tab subscribes to job status changes for its thread.
-- RLS applies to postgres_changes, so the select policy above scopes delivery.
alter publication supabase_realtime add table public.jobs;
