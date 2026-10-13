// components/workspace/mock-agent.ts
//
// DEMO ONLY. This fakes the AI agent so the workspace UI can be tried end to end.
// Replace `runAgent` with a call to your real backend (e.g. POST /api/agent) that
// returns the same shape: { reply, board, suggestions }.
// Retailers and prices below are invented sample data.

import {
  swapTo,
  total,
  money,
  type Alternative,
  type Board,
  type Category,
  type Product,
} from '@/types/workspaces'

type SlotDef = { slot: string; items: Alternative[] }

const item = (
  id: string,
  name: string,
  retailer: string,
  price: number,
  color: string
): Alternative => ({ id, name, retailer, price, color })

const interior: SlotDef[] = [
  {
    slot: 'Lounge chair',
    items: [
      item('i-chair-1', 'Oak lounge chair', 'Hale & Co', 289, '#C9A27A'),
      item('i-chair-2', 'Wicker armchair', 'Soma Home', 219, '#B9A58B'),
      item('i-chair-3', 'Linen accent chair', 'Fieldnote', 179, '#E4DCCD'),
    ],
  },
  {
    slot: 'Sofa',
    items: [
      item('i-sofa-1', 'Low linen sofa', 'Hale & Co', 749, '#D8CDBA'),
      item('i-sofa-2', 'Modular sofa', 'Soma Home', 649, '#CFC4AE'),
      item('i-sofa-3', 'Compact loveseat', 'Fieldnote', 499, '#B9A58B'),
    ],
  },
  {
    slot: 'Coffee table',
    items: [
      item('i-table-1', 'Ash coffee table', 'Soma Home', 189, '#C9A27A'),
      item('i-table-2', 'Round oak table', 'Hale & Co', 159, '#B9915F'),
      item('i-table-3', 'Nesting tables', 'Fieldnote', 119, '#D8CDBA'),
    ],
  },
  {
    slot: 'Floor lamp',
    items: [
      item('i-lamp-1', 'Paper floor lamp', 'Soma Home', 148, '#E8E1D5'),
      item('i-lamp-2', 'Arc linen lamp', 'Fieldnote', 112, '#EFE9DD'),
      item('i-lamp-3', 'Bamboo lamp', 'Soma Home', 89, '#C9A27A'),
    ],
  },
  {
    slot: 'Rug',
    items: [
      item('i-rug-1', 'Wool jute rug', 'Fieldnote', 164, '#B9A58B'),
      item('i-rug-2', 'Flatweave rug', 'Hale & Co', 129, '#CFC4AE'),
      item('i-rug-3', 'Cotton rug', 'Soma Home', 89, '#E4DCCD'),
    ],
  },
  {
    slot: 'Bookshelf',
    items: [
      item('i-shelf-1', 'Oak bookshelf', 'Hale & Co', 249, '#C9A27A'),
      item('i-shelf-2', 'Slim ash shelf', 'Soma Home', 199, '#D8CDBA'),
      item('i-shelf-3', 'Ladder shelf', 'Fieldnote', 139, '#B9915F'),
    ],
  },
  {
    slot: 'Throw',
    items: [
      item('i-throw-1', 'Linen throw', 'Fieldnote', 64, '#7A8B6F'),
      item('i-throw-2', 'Wool blanket', 'Soma Home', 79, '#5E6E55'),
      item('i-throw-3', 'Cotton throw', 'Fieldnote', 39, '#A9B49E'),
    ],
  },
  {
    slot: 'Planter',
    items: [
      item('i-plant-1', 'Ceramic planter', 'Soma Home', 42, '#7A8B6F'),
      item('i-plant-2', 'Stone planter', 'Hale & Co', 58, '#8F9A86'),
      item('i-plant-3', 'Clay pot set', 'Fieldnote', 29, '#A9B49E'),
    ],
  },
]

const gaming: SlotDef[] = [
  {
    slot: 'Monitor',
    items: [
      item('g-mon-1', '34" ultrawide monitor', 'Pixel Forge', 549, '#4B3C9E'),
      item('g-mon-2', '27" QHD monitor', 'Pixel Forge', 329, '#3A2F7A'),
      item('g-mon-3', '32" 4K monitor', 'Lumen Labs', 449, '#2A2250'),
    ],
  },
  {
    slot: 'Keyboard',
    items: [
      item('g-key-1', 'Mechanical keyboard', 'Keycraft', 129, '#2B2724'),
      item('g-key-2', '75% wireless keyboard', 'Keycraft', 99, '#3A3631'),
      item('g-key-3', 'TKL keyboard', 'Keycraft', 79, '#4A453F'),
    ],
  },
  {
    slot: 'Mouse',
    items: [
      item('g-mouse-1', 'Lightweight mouse', 'Keycraft', 79, '#E8E1D5'),
      item('g-mouse-2', 'Wireless mouse', 'Lumen Labs', 59, '#D8CDBA'),
      item('g-mouse-3', 'Ergo mouse', 'Keycraft', 49, '#BDB3A2'),
    ],
  },
  {
    slot: 'Desk',
    items: [
      item('g-desk-1', 'Standing desk', 'Deskwright', 389, '#C9A27A'),
      item('g-desk-2', 'Walnut desk', 'Deskwright', 329, '#8B6B4A'),
      item('g-desk-3', 'Compact desk', 'Hale & Co', 229, '#B9A58B'),
    ],
  },
  {
    slot: 'Chair',
    items: [
      item('g-chair-1', 'Ergonomic chair', 'Deskwright', 299, '#2B2724'),
      item('g-chair-2', 'Mesh task chair', 'Deskwright', 219, '#3A3631'),
      item('g-chair-3', 'Gaming chair', 'Lumen Labs', 179, '#4A453F'),
    ],
  },
  {
    slot: 'Headset',
    items: [
      item('g-head-1', 'Wireless headset', 'Lumen Labs', 149, '#2F3E5C'),
      item('g-head-2', 'Open-back headset', 'Keycraft', 119, '#3E4F73'),
      item('g-head-3', 'Wired headset', 'Lumen Labs', 69, '#54648A'),
    ],
  },
  {
    slot: 'Lighting',
    items: [
      item('g-light-1', 'LED light bars', 'Lumen Labs', 59, '#8B6CFF'),
      item('g-light-2', 'Smart LED strip', 'Lumen Labs', 39, '#A58DFF'),
      item('g-light-3', 'Wall panel lights', 'Pixel Forge', 89, '#7357E6'),
    ],
  },
  {
    slot: 'Desk mat',
    items: [
      item('g-mat-1', 'Oversized desk mat', 'Keycraft', 39, '#2A2250'),
      item('g-mat-2', 'Felt desk mat', 'Hale & Co', 29, '#3A3631'),
      item('g-mat-3', 'Cloth mat', 'Keycraft', 19, '#4A453F'),
    ],
  },
]

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function detectCategory(prompt: string, fallback: Category): Category {
  return /gam|rgb|battlestation|streamer|esports|pc setup|monitor|keyboard/i.test(
    prompt
  )
    ? 'gaming'
    : fallback
}

function parseBudget(prompt: string): number | null {
  const match = prompt.match(/\$\s?([\d,]+)/)
  if (!match) return null
  const value = parseInt(match[1].replace(/,/g, ''), 10)
  return Number.isFinite(value) && value > 0 ? value : null
}

function titleFrom(prompt: string) {
  const clean = prompt.replace(/\s+/g, ' ').trim()
  const cut = clean.length > 56 ? `${clean.slice(0, 56).trimEnd()}…` : clean
  return cut.charAt(0).toUpperCase() + cut.slice(1)
}

function build(defs: SlotDef[]): Product[] {
  return defs.map((d) => ({
    ...d.items[0],
    slot: d.slot,
    locked: false,
    alternatives: d.items.slice(1),
  }))
}

/** Swap unlocked items for cheaper alternatives until the total fits the budget. */
function fitBudget(products: Product[], budget: number): Product[] {
  const list = [...products]

  for (let guard = 0; guard < 24 && total(list) > budget; guard++) {
    let bestIndex = -1
    let bestAlt = ''
    let bestSaving = 0

    for (let i = 0; i < list.length; i++) {
      const p = list[i]
      if (p.locked) continue
      for (const alt of p.alternatives) {
        const saving = p.price - alt.price
        if (saving > bestSaving) {
          bestSaving = saving
          bestIndex = i
          bestAlt = alt.id
        }
      }
    }

    if (bestIndex === -1) break
    list[bestIndex] = swapTo(list[bestIndex], bestAlt)
  }

  return list
}

const suggestionsFor = (category: Category) =>
  category === 'gaming'
    ? ['Make it cheaper', 'Try different pieces', 'Add more RGB']
    : ['Make it cheaper', 'Try different pieces', 'Add warmer lighting']

export type AgentResult = {
  reply: string
  board: Board
  suggestions: string[]
}

export async function runAgent({
  prompt,
  category,
  board,
}: {
  prompt: string
  category: Category
  board: Board
}): Promise<AgentResult> {
  await sleep(2600)

  const text = prompt.toLowerCase()
  const promptBudget = parseBudget(prompt)

  /* First generation */
  if (board.products.length === 0) {
    const cat = detectCategory(prompt, category)
    let products = build(cat === 'gaming' ? gaming : interior)
    if (promptBudget) products = fitBudget(products, promptBudget)

    const sum = total(products)
    const stores = new Set(products.map((p) => p.retailer)).size

    let reply = `I curated ${products.length} pieces from ${stores} retailers into your board, ${money(sum)} in total.`
    if (promptBudget) {
      reply +=
        sum <= promptBudget
          ? ` That keeps you ${money(promptBudget - sum)} under your ${money(promptBudget)} budget.`
          : ` That's ${money(sum - promptBudget)} over your ${money(promptBudget)} budget, so lock what you love and ask me to make it cheaper.`
    }
    reply += ' Lock favorites, swap anything, or tell me what to change.'

    return {
      reply,
      board: { title: titleFrom(prompt), category: cat, budget: promptBudget, products },
      suggestions: suggestionsFor(cat),
    }
  }

  /* Follow-ups */
  let products = board.products
  let budget = promptBudget ?? board.budget
  let reply: string

  const wantsCheaper =
    /cheap|afford|save|lower|less|budget/.test(text) ||
    (promptBudget !== null && promptBudget !== board.budget)

  if (wantsCheaper) {
    const target = promptBudget ?? Math.round(total(products) * 0.85)
    budget = target
    products = fitBudget(products, target)
    const sum = total(products)
    reply =
      sum <= target
        ? `Done. I swapped some unlocked pieces for cheaper options. The board is now ${money(sum)}, ${money(target - sum)} under ${money(target)}.`
        : `This is the closest I can get without changing locked items: ${money(sum)}, still ${money(sum - target)} over ${money(target)}. Unlock a piece and I'll go further.`
  } else {
    products = products.map((p) =>
      p.locked || p.alternatives.length === 0
        ? p
        : swapTo(p, p.alternatives[0].id)
    )
    if (budget) products = fitBudget(products, budget)
    reply = `I refreshed every unlocked piece with new options and kept your locked favorites. The board is now ${money(total(products))}.`
  }

  return {
    reply,
    board: { ...board, budget, products },
    suggestions: suggestionsFor(board.category),
  }
}