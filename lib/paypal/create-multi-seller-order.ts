import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { isPayPalConfigured, paypalRequest } from './client'
import { PayPalApiError, PayPalNotConfiguredError } from './errors'
import { buildPurchaseUnits, payeePayload, prepareCheckoutItems, purchaseRefFor } from './purchase-units'
import { resolvePayees } from './merchants'
import type { CheckoutItemInput, MultiSellerOrderResult } from './types'

/**
 * createMultiSellerOrder — our name for PayPal's documented "multi-seller
 * payments" flow: ONE Orders v2 order whose purchase_units carry one unit per
 * product, each with that product's own payee (intent CAPTURE, reference_id
 * required per unit, PayPal-Partner-Attribution-Id for attribution). PayPal
 * ships no SDK method by this exact name; this wrapper implements the flow
 * from developer.paypal.com "Accept Multi-seller payments".
 *
 * Steps: validate + merge items -> resolve each product's payee -> persist a
 * server-side snapshot (orders + order_items; the board is client state) ->
 * create the PayPal order with PayPal-Request-Id = internal id (idempotent) ->
 * store the PayPal order id. The buyer approves through the JS SDK buttons;
 * captureMultiSellerOrder finishes the payment.
 */
export async function createMultiSellerOrder(input: {
  userId: string
  threadId?: string | null
  items: CheckoutItemInput[]
}): Promise<MultiSellerOrderResult> {
  if (!isPayPalConfigured()) throw new PayPalNotConfiguredError()

  const items = prepareCheckoutItems(input.items)
  const payees = await resolvePayees(items)
  const { units, total } = buildPurchaseUnits(items, payees)

  const supabase = createServiceClient()

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id: input.userId,
      thread_id: input.threadId ?? null,
      currency: 'USD',
      total_amount: total,
      status: 'created',
    })
    .select('id')
    .single()
  if (orderError) throw orderError

  // One order_items row per purchase unit, so each keeps its own capture
  // state (multi-seller captures can be PARTIALLY_COMPLETED per unit).
  const itemRows = items.map((item, index) => {
    const payee = payees.get(item.productId)!
    return {
      order_id: order.id,
      user_id: input.userId,
      product_id: item.productId,
      slot: item.slot ?? null,
      title: item.title,
      retailer: item.retailer,
      unit_price: item.price,
      quantity: item.quantity ?? 1,
      purchase_ref: purchaseRefFor(index, item.productId),
      payee_email: payee.email ?? '',
      payee_merchant_id: payee.merchantId,
    }
  })
  const { error: itemsError } = await supabase.from('order_items').insert(itemRows)
  if (itemsError) throw itemsError

  const { status, body } = await paypalRequest('/v2/checkout/orders', {
    method: 'POST',
    body: {
      intent: 'CAPTURE',
      purchase_units: units.map((unit) => ({
        reference_id: unit.referenceId,
        custom_id: unit.customId,
        payee: payeePayload(unit.payee),
        amount: { currency_code: unit.amount.currency, value: unit.amount.value },
      })),
    },
    // Idempotency: a retried request (same internal order id) returns the
    // same PayPal order instead of creating a duplicate charge.
    requestId: order.id,
  })

  if (status < 200 || status >= 300) {
    const apiError = new PayPalApiError(status, body, `PayPal order creation failed (HTTP ${status})`)
    // Mark the snapshot failed so the buyer-visible board does not point at a
    // half-created order; PayPalApiError still bubbles to the route (502).
    await supabase
      .from('orders')
      .update({
        status: 'failed',
        error: `${apiError.issue ?? 'PAYPAL_ERROR'} (HTTP ${status})`,
      })
      .eq('id', order.id)
    throw apiError
  }

  const paypalOrderId = (body as { id?: string } | null)?.id
  if (typeof paypalOrderId !== 'string' || paypalOrderId.length === 0) {
    await supabase
      .from('orders')
      .update({ status: 'failed', error: 'PayPal order response is missing id' })
      .eq('id', order.id)
    throw new PayPalApiError(status, body, 'PayPal order response is missing id')
  }

  const merchantIds = [...new Set(units.map((unit) => unit.payee.merchantId))]
  return {
    internalOrderId: order.id,
    paypalOrderId,
    status: 'created',
    // The JS SDK needs the seller merchant ids (merchant-id param) for
    // multi-merchant payments, per the official doc.
    merchantIds,
  }
}
