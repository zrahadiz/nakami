import merchants from '@/scripts/paypal-merchants.json'

// PayPal sandbox business accounts available for auto-assignment. When a
// retailer is checked out for the first time it gets one of these merchants at
// random; the choice is persisted in paypal_merchants so later checkouts for
// the same retailer keep paying the same account.

export interface MerchantPoolEntry {
  payeeEmail: string
  payeeMerchantId: string
}

const pool = merchants as MerchantPoolEntry[]

/** Pick a merchant for a retailer that has no paypal_merchants row yet. */
export function pickRandomMerchant(
  random: () => number = Math.random,
  entries: MerchantPoolEntry[] = pool,
): MerchantPoolEntry | null {
  if (entries.length === 0) return null
  // Clamp so an injected random() === 1 cannot read past the end.
  const index = Math.min(entries.length - 1, Math.floor(random() * entries.length))
  return entries[index] ?? null
}
