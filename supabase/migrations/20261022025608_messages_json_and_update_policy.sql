-- Align messages with the schema the application and live project use:
-- one JSON snapshot per thread, and an UPDATE policy for the chat persistence
-- upsert (INSERT ... ON CONFLICT DO UPDATE requires UPDATE, not just INSERT).

alter table public.messages
  add column if not exists messages_json jsonb not null default '[]'::jsonb;

-- The original migration used role/parts; the application never used them and
-- the live project does not have them.
alter table public.messages drop column if exists role;
alter table public.messages drop column if exists parts;

create unique index if not exists messages_thread_id_key
  on public.messages (thread_id);

grant select, insert, update on table public.messages to authenticated;

drop policy if exists "users_update_own_messages" on public.messages;
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
