// Pure payload builders for the multi-seller checkout. No `server-only` here:
// bun tests import these directly, and the server modules use them for
// validation before any DB or PayPal call.

import type { CheckoutItemInput, Payee, PurchaseUnit } from './types'
import { CheckoutValidationError } from './errors'

// PayPal hard limit: "A multi-merchant payment order can contain a maximum of
// 10 purchase_unit objects."
export const MAX_PURCHASE_UNITS = 10

// Amounts are money: round to cents first so float artifacts (0.1 + 0.2)
// cannot leak into the string, then emit exactly two decimals.
export function formatAmount(value: number): string {
  const cents = Math.round(value * 100)
  return (cents / 100).toFixed(2)
}

// purchase_units[].reference_id must match [A-Za-z0-9._-]; product ids from
// Channel3 or the fallback catalog usually comply but are not guaranteed to.
export function sanitizeReferenceId(raw: string): string {
  const cleaned = raw
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return cleaned || 'item'
}

export function purchaseRefFor(index: number, productId: string): string {
  return `${index + 1}-${sanitizeReferenceId(productId)}`
}

// Payee object for the wire format; merchant_id alone is sufficient, email is
// included when the mapping has one (belt and braces in sandbox).
export function payeePayload(payee: Payee): {
  merchant_id: string
  email_address?: string
} {
  return payee.email
    ? { merchant_id: payee.merchantId, email_address: payee.email }
    : { merchant_id: payee.merchantId }
}

/**
 * Validate the cart and merge duplicate products (quantity sums up). One
 * purchase unit per PRODUCT, per the "sandbox merchant account for each
 * product" requirement. Currency is USD-only: the demo's money() formats USD
 * and the sandbox merchant accounts are US-based.
 */
export function prepareCheckoutItems(items: CheckoutItemInput[]): CheckoutItemInput[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new CheckoutValidationError('Checkout requires at least one item')
  }
  const merged: CheckoutItemInput[] = []
  const seen = new Map<string, CheckoutItemInput>()
  for (const item of items) {
    if (!item.productId || !item.title || !item.retailer) {
      throw new CheckoutValidationError('Each item needs productId, title and retailer')
    }
    if (!Number.isFinite(item.price) || item.price <= 0) {
      throw new CheckoutValidationError(
        `Price for ${item.productId} must be a positive amount`,
      )
    }
    if ((item.currency ?? 'USD') !== 'USD') {
      throw new CheckoutValidationError(
        `Only USD checkout is supported (got ${item.currency ?? 'unknown'} for ${item.productId})`,
      )
    }
    const quantity = item.quantity ?? 1
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new CheckoutValidationError(
        `Quantity for ${item.productId} must be a positive integer`,
      )
    }
    const existing = seen.get(item.productId)
    if (existing) {
      existing.quantity = (existing.quantity ?? 1) + quantity
      continue
    }
    const normalized: CheckoutItemInput = {
      ...item,
      currency: item.currency ?? 'USD',
      quantity,
    }
    seen.set(item.productId, normalized)
    merged.push(normalized)
  }
  if (merged.length > MAX_PURCHASE_UNITS) {
    throw new CheckoutValidationError(
      `Multi-seller orders support at most ${MAX_PURCHASE_UNITS} products per PayPal order (got ${merged.length}); batch the checkout`,
    )
  }
  return merged
}

/**
 * One purchase unit per product, each with the product's own payee and a
 * 2-decimal amount. `custom_id` mirrors `reference_id` so webhook
 * PAYMENT.CAPTURE.* events (which echo custom_id) can be routed back to the
 * right order_items row.
 */
export function buildPurchaseUnits(
  items: CheckoutItemInput[],
  payees: Map<string, Payee>,
): { units: PurchaseUnit[]; total: number } {
  const units: PurchaseUnit[] = []
  let totalCents = 0
  items.forEach((item, index) => {
    const payee = payees.get(item.productId)
    if (!payee) {
      throw new CheckoutValidationError(`No PayPal merchant mapped for ${item.productId}`)
    }
    const quantity = item.quantity ?? 1
    const unitCents = Math.round(item.price * 100)
    const cents = unitCents * quantity
    totalCents += cents
    const referenceId = purchaseRefFor(index, item.productId)
    const unitValue = formatAmount(unitCents / 100)
    units.push({
      referenceId,
      customId: referenceId,
      payee,
      amount: {
        currency: 'USD',
        value: formatAmount(cents / 100),
        breakdown: {
          itemTotal: { currency: 'USD', value: formatAmount(cents / 100) },
        },
      },
      items: [
        {
          name: item.title,
          sku: item.productId,
          quantity: String(quantity),
          unitAmount: { currency: 'USD', value: unitValue },
        },
      ],
    })
  })
  return { units, total: totalCents / 100 }
}
