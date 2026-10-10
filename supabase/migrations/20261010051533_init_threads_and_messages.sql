-- BE-1: threads + messages with per-user isolation via RLS.
-- A signed-in user can read/write only their own threads and messages.

create table public.threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  first_prompt text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index threads_user_id_updated_at_idx on public.threads (user_id, updated_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  parts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index messages_thread_id_created_at_idx on public.messages (thread_id, created_at);
create index messages_user_id_idx on public.messages (user_id);

alter table public.threads enable row level security;

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

alter table public.messages enable row level security;

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

-- Data API grants: RLS decides which rows are visible.
grant select, insert, update, delete on table public.threads to authenticated;
grant select, insert on table public.messages to authenticated;
grant all on table public.threads to service_role;
grant all on table public.messages to service_role;
