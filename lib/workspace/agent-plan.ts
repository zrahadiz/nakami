// components/workspace/agent-plan.ts
//
// Turns what the agent streams (the `structured-output` part of an assistant message,
// i.e. your AgentPlanSchema) into the Board + chat view the UI renders.
//
// The reading is deliberately tolerant: it accepts a few common field names so it works
// with your schema as-is. If your AgentPlanSchema uses different names, adjust the
// `first(...)` key lists in `toAlternative` / `readMessagePlan`, that's the only place.
//
// Expected plan shape (any extra fields are ignored):
//   {
//     reply: string,                 // what the assistant says in chat
//     title?: string,
//     category?: 'furniture' | 'gaming',
//     budget?: number,
//     products: [{
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
  const price = num(first(raw, ['price', 'priceUsd', 'amount']))
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

/* ---------- plan -> board ---------- */

function toBoard(plan: Loose, complete: boolean, fallback: Category): Board {
  const rawProducts = Array.isArray(plan.products)
    ? plan.products
    : Array.isArray(plan.items)
      ? plan.items
      : []

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

export function readMessagePlan(
  message: LooseMessage,
  fallback: Category
): PlanView | null {
  if (message.role !== 'assistant') return null

  const part = structuredPart(message)
  if (!part) return null

  const plan = isObj(part.data) ? part.data : isObj(part.partial) ? part.partial : null
  if (!plan) return null

  const complete = isObj(part.data)

  return {
    messageId: message.id,
    complete,
    board: toBoard(plan, complete, fallback),
    reply: str(first(plan, ['reply', 'message', 'summary', 'answer'])) ?? '',
    suggestions: (Array.isArray(plan.suggestions) ? plan.suggestions : [])
      .map(str)
      .filter((s): s is string => !!s)
      .slice(0, 4),
  }
}

export function readLatestPlan(
  messages: LooseMessage[],
  fallback: Category
): PlanView | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const plan = readMessagePlan(messages[i], fallback)
    if (plan) return plan
  }
  return null
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

  return messages.flatMap((m): Message[] => {
    if (m.role === 'user') {
      const text = textOf(m)
      return text ? [{ id: m.id, role: 'user', content: text }] : []
    }

    if (m.role !== 'assistant') return []

    const plan = readMessagePlan(m, opts.fallback)
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