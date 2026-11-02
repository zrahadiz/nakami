import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { CheckoutItemInput, Payee } from './types'
import { UnresolvedMerchantError } from './errors'
import { getPayPalEnv } from './client'
import { pickRandomMerchant } from './merchant-pool'

// "A PayPal sandbox merchant account for each retailer": paypal_merchants maps
// a RETAILER (the store a Channel3 product came from) to the PayPal business
// account that receives its money. Every product from the same retailer pays
// the same merchant, so a board mixing products from one store resolves to one
// payee instead of one per product id. Existing rows always win. In sandbox, a
// retailer seen for the first time gets a merchant picked at random from
// scripts/paypal-merchants.json and that assignment is persisted, so every
// later checkout for that retailer pays the same account.
//
// Service-role client (bypasses RLS): the mapping is server configuration and
// deliberately has no user-facing policies.

interface MerchantRow {
  retailer: string
  payee_email: string
  payee_merchant_id: string
}

export function toPayee(row: MerchantRow): Payee {
  return {
    merchantId: row.payee_merchant_id,
    email: row.payee_email || null,
  }
}

// Pure fallback chain so bun tests can exercise it without a database.
export function pickPayee(row: MerchantRow | undefined, fallback: Payee | null): Payee | null {
  if (row) return toPayee(row)
  return fallback
}

// Platform default payee: PAYPAL_DEFAULT_MERCHANT_ID (+ optional email).
function defaultPayee(): Payee | null {
  const merchantId = process.env.PAYPAL_DEFAULT_MERCHANT_ID
  if (!merchantId) return null
  return { merchantId, email: process.env.PAYPAL_DEFAULT_MERCHANT_EMAIL || null }
}

/** Retailers referenced by the cart, in first-seen order. */
function retailersOf(items: CheckoutItemInput[]): string[] {
  return [...new Set(items.map((item) => item.retailer))]
}

/**
 * Resolve the payee for every (merged) checkout item through its retailer.
 * Retailers with no row yet get a random merchant from
 * scripts/paypal-merchants.json, persisted so later checkouts are stable.
 * Throws UnresolvedMerchantError listing any products still unmapped when the
 * pool is empty and no fallback applies.
 */
export async function resolvePayees(
  items: CheckoutItemInput[],
): Promise<Map<string, Payee>> {
  const productIds = [...new Set(items.map((item) => item.productId))]
  const payees = new Map<string, Payee>()
  if (productIds.length === 0) return payees

  const env = getPayPalEnv()
  const supabase = createServiceClient()
  const retailers = retailersOf(items)

  const { data: rows, error } = await supabase
    .from('paypal_merchants')
    .select('retailer, payee_email, payee_merchant_id')
    .eq('env', env)
    .in('retailer', retailers)
  if (error) throw error

  const byRetailer = new Map<string, MerchantRow>()
  for (const row of rows ?? []) byRetailer.set(row.retailer, row)

  const missing = retailers.filter((retailer) => !byRetailer.has(retailer))
  if (missing.length > 0) {
    const assignments = missing.flatMap((retailer) => {
      // The JSON pool holds sandbox accounts, so it is only used in sandbox.
      // Live relies on explicitly seeded rows or the platform default.
      const merchant = env === 'sandbox' ? pickRandomMerchant() : null
      if (!merchant) return []
      return [
        {
          retailer,
          payee_email: merchant.payeeEmail,
          payee_merchant_id: merchant.payeeMerchantId,
          env,
        },
      ]
    })

    if (assignments.length > 0) {
      // First checkout wins: if two requests race for a new retailer,
      // ignoreDuplicates keeps whichever row landed first.
      const { error: assignError } = await supabase
        .from('paypal_merchants')
        .upsert(assignments, {
          onConflict: 'retailer,env',
          ignoreDuplicates: true,
        })
      if (assignError) throw assignError

      // Re-read so the response reflects the persisted assignment, even when
      // another checkout inserted it between our select and upsert.
      const { data: assignedRows, error: assignedError } = await supabase
        .from('paypal_merchants')
        .select('retailer, payee_email, payee_merchant_id')
        .eq('env', env)
        .in('retailer', missing)
      if (assignedError) throw assignedError
      for (const row of assignedRows ?? []) byRetailer.set(row.retailer, row)
    }
  }

  const fallback = defaultPayee()
  const unresolved: string[] = []
  for (const item of items) {
    const payee = pickPayee(byRetailer.get(item.retailer), fallback)
    if (payee) payees.set(item.productId, payee)
    else unresolved.push(item.productId)
  }
  if (unresolved.length > 0) {
    throw new UnresolvedMerchantError([...new Set(unresolved)])
  }
  return payees
}
