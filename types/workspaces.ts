// components/workspace/workspace-types.ts

export type Category = 'furniture' | 'gaming'

export type Product = {
  id: string
  name: string
  retailer: string
  price: number
  /** Swatch color shown when there is no product photo. */
  color: string
  imageUrl?: string
  url?: string
  /** Stable slot key (e.g. "Floor lamp"). Used as the React key. */
  slot: string
  locked: boolean
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
    // Keep cents visible: PayPal charges the exact amount, so a $1,499.50
    // total must not look like $1,500. Whole-dollar prices stay compact.
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)