# Plan: PayPal Multi-Seller Checkout for nakami

Status: **backend implemented (M1–M3)** — DB migration applied, `lib/paypal/` layer + checkout/webhook routes + seed script live; UI (M4) and sandbox E2E (M5) pending · Date: 2026-10-17
Scope: workspace board ("the board is the cart") → one PayPal checkout that pays each product's own sandbox merchant account.

> Implementation note: the backend uses **plain `fetch`** against the Orders v2 API instead of `@paypal/paypal-server-sdk` — the SDK's runtime covers only 5 endpoints and has no webhook controller, while ~200 lines of fetch cover create/capture/get/verify-signature with full header control (`PayPal-Request-Id` idempotency, `PayPal-Mock-Response` negative testing). No new npm dependencies.

---

## 0. API reality check — read this first

**`createMultiSellerOrder` is not a public PayPal SDK method or REST endpoint.** Verified against:

- PayPal Server SDK (TypeScript) v2.5.0 docs (`paypal/PayPal-TypeScript-Server-SDK`): `OrdersController` exposes `createOrder`, `getOrder`, `patchOrder`, `confirmOrder`, `authorizeOrder`, `captureOrder` — no multi-seller variant.
- DuckDuckGo and Sourcegraph global code search: zero hits for the name.
- PayPal's official docs (via `developer.paypal.com/platforms/checkout/standard/customize/multiseller-payments`, "Accept Multi-seller payments"): the feature is **multi-seller / multi-merchant payments**, implemented with the **ordinary Orders v2 API**: one `POST /v2/checkout/orders` containing **one `purchase_unit` per seller**, each with its own `payee`.

So we implement our own server function **named `createMultiSellerOrder()`** (the name the user asked for) that wraps the real Orders v2 multi-seller payload. Everything below uses the official doc's rules.

### The real API (verified from official docs)

```
POST https://api-m.sandbox.paypal.com/v2/checkout/orders
Headers: Authorization: Bearer <platform token>, PayPal-Partner-Attribution-Id: <BN code>
Body:
{
  "intent": "CAPTURE",            // REQUIRED for multi-seller
  "purchase_units": [             // one PER PRODUCT (user requirement)
    {
      "reference_id": "<order_item ref>",   // REQUIRED when >1 unit
      "payee": { "email_address": "...", "merchant_id": "..." },  // per-product sandbox merchant
      "amount": { "currency_code": "USD", "value": "199.99" }
      // optional: payment_instruction.disbursement_mode + platform_fees
    }
  ]
}
```

Capture: `POST /v2/checkout/orders/{id}/capture` → captures **all** purchase units. Outcomes:

| HTTP | Meaning | Order status |
|---|---|---|
| 201 | every unit captured | `COMPLETED` |
| 207 | **some** units captured | `PARTIALLY_COMPLETED` (inspect per-unit `payments.captures[].status`) |
| 422 | no unit captured (e.g. `INSTRUMENT_DECLINED` per unit) | restart payment flow |
| 504 | >20s processing timeout | poll `GET /v2/checkout/orders/{id}` |

Hard constraints: **max 10 `purchase_units` per order**; `reference_id` required per unit when >1; `intent` must be `CAPTURE`; JS SDK must receive `merchant-id` and `data-merchant-id` (comma-separated merchant list).

---

## 1. How nakami's current shape maps onto this

| Current | Notes for checkout |
|---|---|
| `types/workspaces.ts` `Board { title, budget, products: Product[] }` — `Product { id, name, retailer, price, url, slot, ... }` | The board **is** the cart. `total(products)` already computes the cart total. |
| Board state is **client-side** (`localStorage: nakami:scene-selection:{threadId}`), not in Supabase | Checkout must **snapshot** the items into Supabase at order creation — the server cannot re-read the board later. |
| Prices are plain USD numbers from Channel3 (`lib/channel3.ts`) or `lib/fallback-catalog.ts` | Server re-validates format; stores snapshot in `order_items`. Fallback-catalog prices can be re-verified server-side; Channel3 prices are accepted as a snapshot (risk note below). |
| Supabase tables today: `threads`, `messages`, `jobs`, `assets` | New tables below, plus RLS. Server writes use the existing service-role client (`lib/supabase/service.ts`). |
| `lib/channel3.ts` pattern: server-only module, env-var gate, typed mapping, no client imports | `lib/paypal/*` follows the same conventions. |
| Landing page (`components/landing/sections.tsx`) has an *illustrative* PayPal button | Leave landing as marketing; the real buttons go in the workspace board panel. |
| Tests: `bun test` (`*.test.ts`), `bun run test:live` loads `.env.local` | Sandbox E2E rides `test:live`. |
| Next **16.4.0** — per `AGENTS.md`, must read `node_modules/next/dist/docs/` before writing code | Included as milestone M0. |

---

## 2. Sandbox merchant accounts (one per product)

PayPal orders are created by **one API caller** (the nakami platform app). Each product's sandbox *business* account is attached as the `payee` of its purchase unit — this is exactly how the official multi-seller doc works.

Setup (manual, once):

1. developer.paypal.com → Sandbox → Accounts: create N **Business** accounts, one per product we will seed, e.g. `merchant-<product-slug>@sandbox.nakami.dev`. Also keep/refresh one sandbox **Personal** (buyer) account.
2. Create/reuse the **platform sandbox REST app** (client id + secret). These credentials create and capture orders; the payees receive funds. No per-merchant credentials are needed for multi-seller.
3. Record for each merchant account: `merchant_id` (payer ID of the business account) and `payee_email`.

Mapping strategy ("each product gets a merchant"):

- Supabase table `paypal_merchants` maps `product_id → payee`. Seeded from `lib/fallback-catalog.ts` products (deterministic, id-known).
- Channel3 ids are not enumerable at seed time, so resolution falls back: exact `product_id` → `retailer` row → platform default merchant. New distinct retailers get a row (from a manual/seed list); per-product rows can be added any time to meet the "each product" requirement exactly.
- Seed script `scripts/seed-paypal-merchants.ts` (follows the existing `seed:samples` script pattern).

---

## 3. Data model (Supabase migration, snake_case, RLS on)

```sql
-- who pays whom
create table paypal_merchants (
  product_id       text primary key,       -- catalog product id ('-' fallback slug also allowed)
  retailer         text not null,          -- e.g. 'wayfair.com', used as fallback key
  payee_email      text not null,
  payee_merchant_id text not null,         -- sandbox business payer id
  env              text not null default 'sandbox',
  created_at       timestamptz not null default now()
);

create table orders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null,          -- auth.users.id
  thread_id        uuid references threads (id),
  status           text not null default 'created',  -- created|approved|completed|partially_completed|failed|canceled
  currency         text not null default 'USD',
  total_amount     numeric(10,2) not null,
  paypal_order_id  text unique,
  paypal_payer_id  text,
  paypal_payer_email text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references orders (id) on delete cascade,
  product_id       text not null,
  slot             text,                    -- board slot key (e.g. 'Floor lamp')
  title            text not null,
  retailer         text not null,
  unit_price       numeric(10,2) not null,  -- snapshot at order creation
  quantity         int not null default 1,
  purchase_ref     text not null,           -- == purchase_units[].reference_id
  payee_merchant_id text not null,
  paypal_capture_id text,
  capture_status   text,                    -- COMPLETED | DECLINED | PENDING | ...
  net_amount       numeric(10,2),
  created_at       timestamptz not null default now()
);
```

- RLS: `orders`/`order_items` — `select` own rows only (`auth.uid() = user_id`); **no client-side writes** (service role only).
- Amounts stored as `numeric(10,2)`; serialize to PayPal as 2-decimal **strings** (PayPal requirement).

---

## 4. Server layer — `lib/paypal/` (server-only, mirrors `lib/channel3.ts` style)

| Module | Responsibility |
|---|---|
| `client.ts` | Build PayPal Server SDK client from env; refuse to run without creds; export BN code + `isSandbox`. |
| `merchants.ts` | `resolvePayees(items)`: Supabase (service role) lookup product → retailer → default; batched query; throws when any item has no payee. |
| `create-multi-seller-order.ts` | **`createMultiSellerOrder({ threadId, items })`** — validates (1–10 items, one currency, `price > 0`, ≤ $10k/item), builds purchase_units (one **per product**, `reference_id = deterministic item ref`, `payee` per mapping), calls `ordersController.createOrder({ intent: CAPTURE, … })`, persists `orders` + `order_items` snapshot, returns `{ internalOrderId, paypalOrderId, merchantIds }`. |
| `capture-multi-seller-order.ts` | `captureMultiSellerOrder(internalOrderId)`: capture via SDK; map 201/207/422/504 (on 504 → `getOrder` and reconcile); update `orders.status` and each `order_items` capture fields; return normalized result. |
| `webhooks.ts` | Verify signature via `POST /v1/notifications/verify-webhook-signature` (plain fetch; the SDK has no webhook controller), then apply events: `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED/DECLINED`, `PAYMENT.CAPTURE.REFUNDED`. Idempotent by `paypal_capture_id`. |
| `types.ts` | `CheckoutItem`, `MultiSellerOrderResult`, capture-status unions. |

Dependencies: none for the backend (native `fetch`, see note above); `@paypal/react-paypal-js` (buttons) in M4.

---

## 5. API routes

| Route | Auth | Purpose |
|---|---|---|
| `POST /api/checkout/orders` | session required | Body `{ threadId, items }`; server re-resolves payees + validates; calls `createMultiSellerOrder`; returns `{ internalOrderId, paypalOrderId, merchantIds }`. |
| `POST /api/checkout/orders/[internalOrderId]/capture` | session + ownership | Calls `captureMultiSellerOrder`; returns normalized `{ status, perItem[] }`. |
| `GET /api/checkout/config` | session | `{ clientId, currency, env }` for the script provider. |
| `POST /api/webhooks/paypal` | signature-verified | Webhook ingest, idempotent. Register sandbox webhook URL + `PAYPAL_WEBHOOK_ID`. |

Route-handler specifics (caching, params shape, etc.) must follow the Next 16 docs read in M0 — conventions in `app/api/threads/route.ts` are the in-repo reference.

---

## 6. Front end (workspace)

- `components/workspace/checkout-panel.tsx` (new): renders `<PayPalScriptProvider options={{ clientId, merchantId: merchantIds.join(','), dataMerchantId: 'nakami', currency: 'USD' }}>` → `<PayPalButtons>` with `createOrder → POST /api/checkout/orders`, `onApprove → capture POST`. `merchantId`/`dataMerchantId` satisfy the official multi-merchant JS SDK requirement.
- Board panel footer (`board-panel.tsx`, next to `total(products)`): "Pay with PayPal" opens the checkout panel; show sandbox badge ("Sandbox — no real money charged").
- States: success (order summary with per-item capture status), `PARTIALLY_COMPLETED` (list failed items + "retry failed items" → re-checkout subset), `INSTRUMENT_DECLINED` → surface retry (PayPal's documented restart), cancel → stay on board.
- If board > 10 products: chunk into batches of ≤10 and create sequential PayPal orders (10-unit cap is a PayPal hard limit). One batch UI-wise; each batch shows its own capture state. (Future option: group units per merchant to shrink batches.)
- Config fetch once on board tab mount (React Query is already available).

---

## 7. Environment (.env.example additions; never commit .env.local)

```
PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=<platform sandbox app client id>
PAYPAL_CLIENT_SECRET=<platform sandbox app secret>
PAYPAL_BN_CODE=<PayPal-Partner-Attribution-Id BN code>
PAYPAL_WEBHOOK_ID=<sandbox webhook id>
PAYPAL_PLATFORM_FEE_USD=0        # optional platform_fees per unit
PAYPAL_DEFAULT_MERCHANT_ID=...   # fallback payee when no mapping
```

---

## 8. Testing

- **Unit (bun)**: purchase-unit builder (one unit per product, per-product payee, `reference_id`, 2-decimal strings), 10-unit cap, currency uniformity, capture status mapping (201/207/422/504), payee resolution fallback chain. Plain `bun test`, no network.
- **Sandbox E2E (`bun run test:live`)**: create order → approve manually as sandbox **personal** buyer → capture; assert `COMPLETED` and per-item captures persisted.
- **Negative testing**: use the `PayPal-Mock-Response` header (documented sandbox feature) to simulate declined captures → assert 207/422 handling.
- **Webhook**: PayPal webhooks dashboard "resend" against a local tunnel, or a signed-payload fixture test for `webhooks.ts`.

---

## 9. Milestones

| # | Deliverable | Verify | Status |
|---|---|---|---|
| M0 | Read `node_modules/next/dist/docs/` (route handlers, env, caching) · env vars in `.env.example` | `bun run lint` passes | ✅ |
| M1 | Migration `paypal_merchants/orders/order_items` + RLS applied to remote; seed script + example JSON (`bun run seed:merchants`) | advisor clean on new tables | ✅ (sandbox accounts pending user) |
| M2 | `lib/paypal/*` incl. **`createMultiSellerOrder()`** + `captureMultiSellerOrder()` | `bun test` 85 pass / 0 fail | ✅ |
| M3 | `/api/checkout/*` + `/api/webhooks/paypal` routes | curl create→capture round-trip in sandbox | ✅ code (E2E pending creds) |
| M4 | Checkout UI in board panel (buttons, merchantId list, states) | manual E2E: pay board as sandbox buyer | ✅ code (E2E pending creds) |
| M5 | Partial-failure UX polish, webhook registration, E2E script, README docs | `bun run test:live` green | ⬜ |

Frontend notes (M4): `components/workspace/checkout-panel.tsx` mounts in the board footer's order-summary drawer, replacing the "Payment coming soon" placeholder. It pays the **selected items, or all items** (matching the footer total), resolves payee merchant ids via `POST /api/checkout/merchants` before mounting the script (official multi-merchant requirement), then createOrder → approve → capture with 504 retry. Boards with >10 products surface the server's batching message (sequential batching is M5).

Routes follow the Next 16 conventions verified in `node_modules/next/dist/docs/`: `RouteContext<"/api/checkout/orders/[id]/capture">` with **`await ctx.params`** (params is a Promise in this version — note: the pre-existing `app/api/threads/[id]/route.ts` had the sync-access bug and was fixed in passing).

M2–M3 = backend (orderable milestone), M4 = UI, M5 = hardening.

---

## 10. Risks & open questions

- **Price trust**: Channel3 prices arrive from the client board. Mitigation: server snapshot + sanity bounds now; optional re-verification via `searchProducts` by id later.
- **10-unit cap**: per-product purchase units mean boards >10 products need batched orders (M4/M5). Alternative — one unit per merchant — changes the "per product" requirement; left as a documented knob.
- **Platform fees / refunds / shipping**: not requested. `platform_fees` env defaults 0; refunds tracked for later (`payments.captures[].refund` HATEOAS); shipping omitted for the demo.
- **Onboarding**: real production multi-seller requires sellers onboarded to the platform account; sandbox does not, which is why per-product sandbox business accounts as `payee` work for the demo.
- **Open question for user**: should nakami take a platform fee per seller (env knob exists but defaults to 0)?
