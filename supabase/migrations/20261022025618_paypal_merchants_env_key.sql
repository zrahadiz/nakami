-- Merchant mappings are environment-scoped. The original primary key only
-- covered product_id, which made a live mapping collide with an existing
-- sandbox row and prevented separate sandbox/live assignments.
alter table public.paypal_merchants
  drop constraint if exists paypal_merchants_pkey;

alter table public.paypal_merchants
  add constraint paypal_merchants_pkey primary key (product_id, env);
