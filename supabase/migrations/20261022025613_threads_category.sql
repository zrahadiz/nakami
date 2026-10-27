-- Persist the shopping category so a board created as "Gaming" stays a gaming
-- board after reload, and the chat/agent can be told the current category.
alter table public.threads
  add column if not exists category text not null default 'furniture'
  check (category in ('furniture', 'gaming'));
