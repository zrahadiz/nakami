import { api } from '@/lib/api/axios'
import type { Transaction } from '@/lib/paypal/types'

export async function getOrders(): Promise<Transaction[]> {
  const { data } = await api.get<Transaction[]>('/checkout/orders')

  return data
}
