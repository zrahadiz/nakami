-- PayPal multi-seller checkout (plan: docs/plans/paypal-multiseller-checkout.md).
--
-- paypal_merchants: maps a catalog product (then retailer, then a platform
--   default) to the PayPal sandbox business account that receives the money
--   ("payee"). Global config data, not user data: RLS is enabled with no
--   policies so only the service role (bypasses RLS) can read it.
--
-- orders / order_items: server-side snapshot of the board that is checked out.
--   One purchase_unit per product, so every order_item tracks its own PayPal
--   capture (multi-seller captures can be PARTIALLY_COMPLETED per unit).
--   Written by the server through the service role only; users may read their
--   own rows.

create table public.paypal_merchants (
  product_id        text primary key,
  retailer          text not null,
  payee_email       text not null,
  payee_merchant_id text not null,
  env               text not null default 'sandbox',
  created_at        timestamptz not null default now()
);

-- Resolution falls back product -> retailer -> default, so retailer needs an index.
create index paypal_merchants_retailer_idx on public.paypal_merchants (retailer);

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
