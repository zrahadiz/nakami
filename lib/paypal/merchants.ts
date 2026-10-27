import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { CheckoutItemInput, Payee } from './types'
import { UnresolvedMerchantError } from './errors'
import { getPayPalEnv } from './client'
import { pickRandomMerchant } from './merchant-pool'

// "A PayPal sandbox merchant account for each product": paypal_merchants maps
// a catalog product to the PayPal business account that receives its money.
// Existing rows always win. In sandbox, a product seen for the first time gets
// a merchant picked at random from scripts/paypal-merchants.json and that
// assignment is persisted, so every later checkout pays the same account.
//
// Service-role client (bypasses RLS): the mapping is server configuration and
// deliberately has no user-facing policies.

interface MerchantRow {
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
export function pickPayee(
  exact: MerchantRow | undefined,
  byRetailer: MerchantRow | undefined,
  fallback: Payee | null,
): Payee | null {
  if (exact) return toPayee(exact)
  if (byRetailer) return toPayee(byRetailer)
  return fallback
}

// Platform default payee: PAYPAL_DEFAULT_MERCHANT_ID (+ optional email).
function defaultPayee(): Payee | null {
  const merchantId = process.env.PAYPAL_DEFAULT_MERCHANT_ID
  if (!merchantId) return null
  return { merchantId, email: process.env.PAYPAL_DEFAULT_MERCHANT_EMAIL || null }
}

/**
 * Resolve the payee for every (merged) checkout item. Products with no row yet
 * get a random merchant from scripts/paypal-merchants.json, persisted so later
 * checkouts are stable. Throws UnresolvedMerchantError listing any products
 * still unmapped when the pool is empty and no fallback applies.
 */
export async function resolvePayees(
  items: CheckoutItemInput[],
): Promise<Map<string, Payee>> {
  const productIds = [...new Set(items.map((item) => item.productId))]
  const payees = new Map<string, Payee>()
  if (productIds.length === 0) return payees

  const env = getPayPalEnv()
  const supabase = createServiceClient()

  const { data: exactRows, error: exactError } = await supabase
    .from('paypal_merchants')
    .select('product_id, payee_email, payee_merchant_id')
    .eq('env', env)
    .in('product_id', productIds)
  if (exactError) throw exactError

  const byProduct = new Map<string, MerchantRow>()
  for (const row of exactRows ?? []) byProduct.set(row.product_id, row)

  const missing = productIds.filter((id) => !byProduct.has(id))
  if (missing.length > 0) {
    const itemByProduct = new Map(items.map((item) => [item.productId, item]))
    const assignments = missing.flatMap((productId) => {
      // The JSON pool holds sandbox accounts, so it is only used in sandbox.
      // Live relies on explicitly seeded rows or the platform default.
      const merchant = env === 'sandbox' ? pickRandomMerchant() : null
      const item = itemByProduct.get(productId)
      if (!merchant || !item) return []
      return [
        {
          product_id: productId,
          retailer: item.retailer,
          payee_email: merchant.payeeEmail,
          payee_merchant_id: merchant.payeeMerchantId,
          env,
        },
      ]
    })

    if (assignments.length > 0) {
      // First checkout wins: if two requests race for a new product,
      // ignoreDuplicates keeps whichever row landed first.
      const { error: assignError } = await supabase
        .from('paypal_merchants')
        .upsert(assignments, {
          onConflict: 'product_id,env',
          ignoreDuplicates: true,
        })
      if (assignError) throw assignError

      // Re-read so the response reflects the persisted assignment, even when
      // another checkout inserted it between our select and upsert.
      const { data: assignedRows, error: assignedError } = await supabase
        .from('paypal_merchants')
        .select('product_id, payee_email, payee_merchant_id')
        .eq('env', env)
        .in('product_id', missing)
      if (assignedError) throw assignedError
      for (const row of assignedRows ?? []) byProduct.set(row.product_id, row)
    }
  }

  const stillMissing = productIds.filter((id) => !byProduct.has(id))
  const byRetailer = new Map<string, MerchantRow>()
  if (stillMissing.length > 0) {
    const retailers = [
      ...new Set(
        items
          .filter((item) => stillMissing.includes(item.productId))
          .map((item) => item.retailer),
      ),
    ]
    const { data: retailerRows, error: retailerError } = await supabase
      .from('paypal_merchants')
      .select('product_id, payee_email, payee_merchant_id, retailer')
      .eq('env', env)
      .in('retailer', retailers)
      // Deterministic "first row per retailer" so the preflight merchants
      // endpoint and order creation resolve the same fallback payee.
      .order('created_at', { ascending: true })
      .order('product_id', { ascending: true })
    if (retailerError) throw retailerError
    for (const row of (retailerRows ?? []) as Array<MerchantRow & { retailer: string }>) {
      // First mapping per retailer wins; per-product rows can refine it later.
      if (!byRetailer.has(row.retailer)) byRetailer.set(row.retailer, row)
    }
  }

  const fallback = defaultPayee()
  const unresolved: string[] = []
  for (const item of items) {
    const payee = pickPayee(byProduct.get(item.productId), byRetailer.get(item.retailer), fallback)
    if (payee) payees.set(item.productId, payee)
    else unresolved.push(item.productId)
  }
  if (unresolved.length > 0) {
    throw new UnresolvedMerchantError([...new Set(unresolved)])
  }
  return payees
}
