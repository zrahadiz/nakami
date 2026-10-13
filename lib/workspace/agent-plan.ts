// components/workspace/agent-plan.ts
//
// Turns what the agent streams (the `structured-output` part of an assistant message,
// i.e. AgentPlanSchema) into the Board + chat view the UI renders.
//
// AgentPlanSchema references products by id only (summary, searchQuery, productIds,
// ...). The product details (title, price, retailer, image) ride along in the same
// assistant message, on the `search_channel3` tool-call parts — `output` on live
// streamed parts, `result` on parts persisted by /api/chat. `toBoard` resolves the
// plan's productIds through those search results, so a live stream and a reloaded
// history produce the same board. A refinement plan may reuse ids from an earlier
// run's search ("keep the unchanged items, search only for the replacements"), so
// `readLatestPlan` seeds the id catalog from every message before the plan too.
//
// The reading is deliberately tolerant: it also accepts plans that carry full
// products inline (any extra fields are ignored):
//   {
//     reply?: string,                // what the assistant says in chat (or summary)
//     title?: string,
//     category?: 'furniture' | 'gaming',
//     budget?: number,
//     productIds: string[],          // resolved against search_channel3 results
//     products?: [{                  // optional inline variant
//       slot?: string,               // e.g. "Floor lamp" (falls back to the product name)
//       name: string, retailer: string, price: number,
//       imageUrl?: string, url?: string, color?: string,
//       alternatives?: [{ name, retailer, price, imageUrl?, url? }]
//     }],
//     suggestions?: string[]         // follow-up chips
//   }

import type {
  Activity,
  Alternative,
  Board,
  Category,
  Message,
  Product,
} from '@/types/workspaces'

type Loose = Record<string, unknown>

/** Minimal shape of a TanStack AI UIMessage (kept loose so library updates don't break us). */
export type LooseMessage = { id: string; role: string; parts?: unknown[] }

export type PlanView = {
  messageId: string
  /** false while the structured JSON is still streaming. */
  complete: boolean
  board: Board
  reply: string
  suggestions: string[]
}

/* ---------- helpers ---------- */

const isObj = (v: unknown): v is Loose =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const str = (v: unknown) =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined

const num = (v: unknown) => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && /^[\d.,]+$/.test(v.trim())) {
    const n = parseFloat(v.replace(/,/g, ''))
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

const first = (o: Loose, keys: string[]) =>
  keys.map((k) => o[k]).find((v) => v !== undefined && v !== null)

/** Price as a plain number, tolerating the nested `{ amount, currency }` shape
 * the search tools return (lib/types.ts Product.price). */
function priceOf(raw: Loose): number | undefined {
  const direct = num(first(raw, ['price', 'priceUsd', 'amount']))
  if (direct !== undefined) return direct
  const nested = raw.price
  if (isObj(nested)) return num(first(nested, ['amount', 'price']))
  return undefined
}

const palette = [
  '#C9A27A', '#B9A58B', '#7A8B6F', '#D8CDBA',
  '#8B6CFF', '#2F3E5C', '#E4DCCD', '#D9623B',
]

function fallbackColor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return palette[Math.abs(h) % palette.length]
}

function toAlternative(raw: unknown, slot: string): Alternative | null {
  if (!isObj(raw)) return null

  const name = str(first(raw, ['name', 'title']))
  const price = priceOf(raw)
  if (!name || price === undefined) return null

  return {
    id: str(raw.id) ?? `${slot}::${name}`,
    name,
    price,
    retailer:
      str(first(raw, ['retailer', 'store', 'merchant', 'vendor', 'source'])) ??
      'Retailer',
    color: str(raw.color) ?? fallbackColor(name),
    imageUrl: str(first(raw, ['imageUrl', 'image', 'thumbnail', 'image_url'])),
    url: str(first(raw, ['url', 'link', 'productUrl', 'product_url'])),
  }
}

function toCategory(value: unknown, fallback: Category): Category {
  const v = typeof value === 'string' ? value.toLowerCase() : ''
  if (v.includes('gam')) return 'gaming'
  if (v.includes('furn') || v.includes('interior') || v.includes('living')) {
    return 'furniture'
  }
  return fallback
}

/* ---------- search results -> id catalog ---------- */

/**
 * Product payloads streamed inside tool-call parts. Live parts carry the tool
 * output on `output`; the parts persisted by /api/chat carry it on `result`.
 * search_channel3 returns `{ products: [...] }`; other tools have no `products`
 * array and are ignored naturally.
 */
function toolProductsOf(part: Loose): Loose[] {
  const payload = isObj(part.output) ? part.output : isObj(part.result) ? part.result : null
  if (!payload) return []
  return (Array.isArray(payload.products) ? payload.products : []).filter(isObj)
}

/** Index every search result in the message by product id (newest wins). */
function collectToolProducts(message: LooseMessage, catalog: Map<string, Loose>) {
  for (const part of message.parts ?? []) {
    if (!isObj(part) || part.type !== 'tool-call') continue
    for (const product of toolProductsOf(part)) {
      const id = str(product.id)
      if (id) catalog.set(id, product)
    }
  }
}

/* ---------- plan -> board ---------- */

function toBoard(
  plan: Loose,
  complete: boolean,
  fallback: Category,
  catalog: Map<string, Loose>
): Board {
  const explicit = Array.isArray(plan.products)
    ? plan.products
    : Array.isArray(plan.items)
      ? plan.items
      : null

  // The agent's plan references products by id (AgentPlanSchema.productIds); the
  // details come from the streamed search_channel3 results. Ids that never
  // appeared in a search result (hallucinated) are skipped.
  const resolved =
    explicit === null && Array.isArray(plan.productIds)
      ? plan.productIds
          .map((id) => catalog.get(str(id) ?? ''))
          .filter((p): p is Loose => isObj(p))
      : []

  const rawProducts = explicit ?? resolved

  // While JSON is still streaming, the last array element may be half-written.
  const usable = complete ? rawProducts : rawProducts.slice(0, -1)

  const seen = new Set<string>()
  const products: Product[] = []

  for (const raw of usable) {
    if (!isObj(raw)) continue

    let slot = str(first(raw, ['slot', 'type', 'role', 'category'])) ?? str(first(raw, ['name', 'title']))
    if (!slot) continue

    const main = toAlternative(raw, slot)
    if (!main) continue

    // Keep slot keys unique (two "Chair" entries etc.).
    let unique = slot
    for (let n = 2; seen.has(unique); n++) unique = `${slot} ${n}`
    slot = unique
    seen.add(slot)

    const alternatives = (Array.isArray(raw.alternatives) ? raw.alternatives : [])
      .map((a) => toAlternative(a, slot))
      .filter((a): a is Alternative => a !== null)

    products.push({ ...main, slot, locked: false, alternatives })
  }

  return {
    title: str(plan.title) ?? '',
    category: toCategory(plan.category, fallback),
    budget: num(plan.budget) ?? null,
    products,
  }
}

function structuredPart(message: LooseMessage): Loose | null {
  for (const part of message.parts ?? []) {
    if (isObj(part) && part.type === 'structured-output') return part
  }
  return null
}

/** The structured plan object of an assistant message, if it has a readable one. */
function planDataOf(message: LooseMessage): { plan: Loose; complete: boolean } | null {
  if (message.role !== 'assistant') return null

  const part = structuredPart(message)
  if (!part) return null

  const plan = isObj(part.data) ? part.data : isObj(part.partial) ? part.partial : null
  if (!plan) return null

  return { plan, complete: isObj(part.data) }
}

export function readMessagePlan(
  message: LooseMessage,
  fallback: Category,
  catalog: Map<string, Loose> = new Map()
): PlanView | null {
  const data = planDataOf(message)
  if (!data) return null

  // Merge this message's own search results over any pre-seeded ones so its
  // ids win.
  collectToolProducts(message, catalog)

  return {
    messageId: message.id,
    complete: data.complete,
    board: toBoard(data.plan, data.complete, fallback, catalog),
    reply: str(first(data.plan, ['reply', 'message', 'summary', 'answer'])) ?? '',
    suggestions: (Array.isArray(data.plan.suggestions) ? data.plan.suggestions : [])
      .map(str)
      .filter((s): s is string => !!s)
      .slice(0, 4),
  }
}

export function readLatestPlan(
  messages: LooseMessage[],
  fallback: Category
): PlanView | null {
  // Newest assistant message that carries a readable plan.
  let index = -1
  for (let i = messages.length - 1; i >= 0; i--) {
    if (planDataOf(messages[i])) {
      index = i
      break
    }
  }
  if (index === -1) return null

  // A refinement plan may reuse ids from an earlier run's search ("keep the
  // unchanged items, search only for the replacements"), so the catalog spans
  // every message before the plan too. The plan message's own results are
  // added last, inside readMessagePlan, so they override older duplicates.
  const catalog = new Map<string, Loose>()
  for (let i = 0; i < index; i++) collectToolProducts(messages[i], catalog)

  return readMessagePlan(messages[index], fallback, catalog)
}

/**
 * Adopt a new plan but keep locked items: if you locked a slot, it stays exactly as it was,
 * even if the agent proposed something else (or dropped it).
 */
export function mergeBoard(prev: Board, next: Board): Board {
  const locked = new Map(prev.products.filter((p) => p.locked).map((p) => [p.slot, p]))

  const products = next.products.map((p) => locked.get(p.slot) ?? p)
  for (const [slot, p] of locked) {
    if (!products.some((x) => x.slot === slot)) products.push(p)
  }

  return { ...next, products }
}

/* ---------- messages -> chat view ---------- */

function textOf(message: LooseMessage) {
  return (message.parts ?? [])
    .map((p) => {
      if (!isObj(p) || p.type !== 'text') return ''
      // Live parts use `content`; user messages saved by /api/chat use `text`.
      if (typeof p.content === 'string') return p.content
      if (typeof p.text === 'string') return p.text
      return ''
    })
    .join('')
    .trim()
}

function humanizeTool(name: string) {
  if (/search|find|look|fetch/i.test(name)) return 'Searching retailers'
  const spaced = name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

const working = new Set([
  'awaiting-input',
  'input-streaming',
  'input-complete',
  'approval-requested',
  'approval-responded',
])

function activityOf(message: LooseMessage, live: boolean): Activity[] {
  const groups = new Map<string, Activity>()

  for (const part of message.parts ?? []) {
    if (!isObj(part) || part.type !== 'tool-call') continue

    const label = humanizeTool(String(part.name ?? 'tool'))
    const state = String(part.state ?? '')
    const group = groups.get(label) ?? { label, count: 0, done: true, failed: false }

    group.count += 1
    group.done = group.done && (!live || !working.has(state))
    group.failed = group.failed || state === 'error'
    groups.set(label, group)
  }

  return [...groups.values()]
}

export function toViewMessages(
  messages: LooseMessage[],
  opts: { workedFor: Record<string, number>; running: boolean; fallback: Category }
): Message[] {
  const lastId = messages[messages.length - 1]?.id

  // Product details arrive on search tool-call parts; keep a running catalog so
  // each bubble's boardCount resolves ids against the searches before it.
  const catalog = new Map<string, Loose>()

  return messages.flatMap((m): Message[] => {
    collectToolProducts(m, catalog)

    if (m.role === 'user') {
      const text = textOf(m)
      return text ? [{ id: m.id, role: 'user', content: text }] : []
    }

    if (m.role !== 'assistant') return []

    const plan = readMessagePlan(m, opts.fallback, catalog)
    const live = opts.running && m.id === lastId
    const activity = activityOf(m, live)
    const content = plan?.reply || textOf(m)

    if (!content && activity.length === 0) return []

    return [
      {
        id: m.id,
        role: 'assistant',
        content,
        activity,
        workedFor: opts.workedFor[m.id],
        suggestions: plan?.complete && plan.suggestions.length ? plan.suggestions : undefined,
        boardCount: plan?.complete ? plan.board.products.length : undefined,
      },
    ]
  })
}