# Nakami

**Describe a room in one sentence. Get a shoppable board of real products. See it in 3D.**

Nakami (中身, "contents") is an AI interior-design and gaming-setup shopping assistant. You write a brief like *"a cozy Japandi living room under $2,000"*, an agent searches real retailers through [Channel3](https://channel3.com), returns a board of products with prices and links, lays the chosen pieces out in a procedural 3D room, and lets you check out every item — from different sellers — in a single PayPal order.

---

## Features

### Conversational shopping agent
- Natural-language briefs instead of filters: style, space, and budget are all understood from one sentence.
- Streaming chat with server-side tools (TanStack AI), so the agent can search, size, and place products *before* it answers.

### Real product search
- Channel3 SDK search over a universal catalog; best offer per product is picked automatically (price, retailer, availability, normalized image).
- Budget is treated as a hard constraint, and every category in the brief is searched.

### Generated 3D models
- Generate 3D scene based on the chosen products for visualization.

### Multi-seller PayPal checkout
- One Orders v2 order with one purchase unit per product, each paying the merchant account of the retailer it came from (PayPal's multi-seller payments flow).

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 16** (App Router) |
| UI | **React 19**, **Tailwind CSS 4**, shadcn, lucide icons |
| AI | **TanStack AI** (`@tanstack/ai` + OpenRouter adapter), server tools, SSE streaming, resumable streams, `@tanstack/ai-persistence` |
| 3D | **three.js** + **React Three Fiber** + **drei** |
| Products | **Channel3** SDK (catalog, offers, images) |
| Payments | **PayPal** Orders v2, multi-seller payments, webhooks |
| Data & auth | **Supabase** — Postgres, Auth, Storage |
| Data fetching | **TanStack Query** |
| Validation | **Zod** |
| Tooling | **Bun** 1.4, TypeScript 5, ESLint 9 |

---

## How it fits together

```
Prompt ──► /api/chat (TanStack AI + OpenRouter)
              │
              ├─ search_channel3 ──► Channel3 catalog
              ├─ estimate_dimensions ──► category bounding boxes (cm)
              └─ build_scene_layout ──► deterministic placement JSON (meters)
              │
              ├─► streamed SSE + structured plan ──► product board (client)
              └─► messages persisted per thread (Supabase)

Board item ──► /api/jobs ──► 3D generation queue ──► worker polls ──► GLB ──► Storage
                                                              └─► assets + jobs rows

Board ──► /api/checkout/orders ──► one PayPal order, N purchase units (one payee per retailer)
              └─► capture ──► per-item status ──► orders + order_items
```

Key modules:

| Path | Responsibility |
|---|---|
| `app/api/chat/route.ts` | Agent endpoint: streaming, tools, persistence |
| `lib/agent/` | System prompt, tool definitions, plan schema, dimension heuristics |
| `lib/scene/contract.ts` | Coordinate system, room presets, placement types (single source of truth) |
| `lib/scene/layout.ts` | Rule-based, deterministic layout engine |
| `lib/channel3.ts` | Product search + normalization |
| `lib/jobs/` | Background worker, content-addressed cache keys |
| `lib/paypal/` | Multi-seller orders, capture interpretation, merchant pool, webhooks |
| `lib/supabase/` | Browser/server/service clients, middleware, row mappers |
| `components/workspace/` | Chat, board, 3D preview, checkout, orders |
| `supabase/migrations/` | Schema, RLS policies, storage buckets |

---

## Getting started

### Prerequisites
- [Bun](https://bun.sh) 1.4+
- A Supabase project (hosted or local via the Supabase CLI)

### 1. Install

```bash
bun install
```

### 2. Configure

```bash
cp .env.example .env.local
```

Required:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only: workers, webhooks, seeding |
| `LLM_API_KEY` | OpenRouter key used by `POST /api/chat` |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | Paypal checkout |
| `CHANNEL3_API_KEY` | Real product search through Channel3 |
| `PAYPAL_ENV` | Fill with "sandbox" for now |

### 3. Set up the database

Apply migrations to your Supabase project (this creates the tables, RLS policies, and the `product-images` / `glb-cache` / `thread-thumbnails` buckets):

```bash
supabase link --project-ref <your-ref>
bun run db:migrate
```

Seed sample data:

```bash
bun run seed:samples                         # CC0 furniture GLBs -> glb-cache/samples
bun run seed:merchants                       # retailer -> payee rows from scripts/paypal-merchants.json
```

Copy `scripts/paypal-merchants.example.json` to `scripts/paypal-merchants.json` first for real sandbox merchant accounts.

### 4. Run

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000). `/` redirects to `/landing`; the workspace lives under `/dashboard`, `/orders`, and `/workspace/[id]`.

---

## Scripts

| Command | What it does |
|---|---|
| `bun dev` | Start the dev server |
| `bun run build` / `bun start` | Production build and serve |
| `bun run lint` | ESLint |
| `bun test` | Unit tests (offline) |
| `bun run test:live` | Tests against real services, using `.env.local` |
| `bun run db:migrate` | Push pending migrations to the linked Supabase project |
| `bun run seed:samples` | Upload sample GLBs to Storage |
| `bun run seed:merchants` | Seed retailer → PayPal payee rows |

Tests cover the pure parts of the system: scene contract and layout rules, fal model mapping and mock driver, cache keys, PayPal purchase-unit building and capture interpretation, and workspace plan parsing.
