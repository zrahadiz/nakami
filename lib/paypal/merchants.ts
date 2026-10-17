import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { CheckoutItemInput, Payee } from './types'
import { UnresolvedMerchantError } from './errors'

// "A PayPal sandbox merchant account for each product": paypal_merchants maps
// a catalog product to the PayPal business account that receives its money.
// Resolution falls back product -> retailer -> platform default, because
// Channel3 ids are not enumerable at seed time.
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
 * Resolve the payee for every (merged) checkout item. Throws
 * UnresolvedMerchantError listing the products that have no mapping at all —
 * the route answers 503 and names them so the mapping can be fixed.
 */
export async function resolvePayees(
  items: CheckoutItemInput[],
): Promise<Map<string, Payee>> {
  const productIds = [...new Set(items.map((item) => item.productId))]
  const payees = new Map<string, Payee>()
  if (productIds.length === 0) return payees

  const supabase = createServiceClient()

  const { data: exactRows, error: exactError } = await supabase
    .from('paypal_merchants')
    .select('product_id, payee_email, payee_merchant_id')
    .in('product_id', productIds)
  if (exactError) throw exactError

  const byProduct = new Map<string, MerchantRow>()
  for (const row of exactRows ?? []) byProduct.set(row.product_id, row)

  const missing = productIds.filter((id) => !byProduct.has(id))
  const byRetailer = new Map<string, MerchantRow>()
  if (missing.length > 0) {
    const retailers = [
      ...new Set(
        items
          .filter((item) => missing.includes(item.productId))
          .map((item) => item.retailer),
      ),
    ]
    const { data: retailerRows, error: retailerError } = await supabase
      .from('paypal_merchants')
      .select('product_id, payee_email, payee_merchant_id, retailer')
      .in('retailer', retailers)
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
