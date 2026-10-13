// components/workspace/workspace-types.ts

export type Category = 'furniture' | 'gaming'

export type Alternative = {
  id: string
  name: string
  retailer: string
  price: number
  /** Swatch color shown when there is no product photo. */
  color: string
  imageUrl?: string
  url?: string
}

export type Product = Alternative & {
  /** Stable slot key (e.g. "Floor lamp"). Used as the React key. */
  slot: string
  locked: boolean
  alternatives: Alternative[]
}

export type Board = {
  title: string
  category: Category
  budget: number | null
  products: Product[]
}

export type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  /** Seconds the agent worked, shown as "Worked for 29s". */
  workedFor?: number
  /** One-tap follow-ups shown under the latest assistant message. */
  suggestions?: string[]
  /** If set, shows a "View board" button (useful on mobile). */
  boardCount?: number
  /** Tool calls the agent made (e.g. product searches), shown as progress lines. */
  activity?: Activity[]
}

export type Activity = {
  label: string
  count: number
  done: boolean
  failed?: boolean
}

export const emptyBoard: Board = {
  title: '',
  category: 'furniture',
  budget: null,
  products: [],
}

export const total = (products: Product[]) =>
  products.reduce((sum, p) => sum + p.price, 0)

export const money = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)

/** Swap a product for one of its alternatives; the old item becomes an alternative. */
export function swapTo(product: Product, altId: string): Product {
  const alt = product.alternatives.find((a) => a.id === altId)
  if (!alt) return product

  const { slot, locked, alternatives, ...current } = product
  return {
    ...alt,
    slot,
    locked,
    alternatives: [current, ...alternatives.filter((a) => a.id !== altId)],
  }
}