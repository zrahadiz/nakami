import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { Tables } from '@/lib/supabase/database.types'
import { isPayPalConfigured, paypalRequest } from './client'
import { CheckoutNotFoundError, PayPalApiError, PayPalNotConfiguredError } from './errors'
import { captureUnitsFromOrder, declinedRefsFrom422, orderStatusFromPayPal } from './order-interpretation'
import type { CaptureItemResult, CaptureResult } from './types'

type OrderRow = Pick<
  Tables<'orders'>,
  'id' | 'status' | 'paypal_order_id' | 'paypal_payer_id' | 'paypal_payer_email'
>

/**
 * captureMultiSellerOrder — capture an approved multi-seller order. PayPal
 * captures EVERY purchase unit in one call; the official outcomes are:
 *
 *   201  every unit captured            -> order 'completed'
 *   207  some units captured            -> 'partially_completed' (per-unit
 *                                        statuses inspected below)
 *   422  no unit captured (e.g. all
 *        INSTRUMENT_DECLINED)           -> 'failed'; UI restarts the payment
 *   504  processing timeout             -> reconcile via GET order, else
 *                                        report processing=true
 *
 * Idempotent: a finalized order returns its persisted state instead of
 * hitting PayPal again; a retry after 504 re-checks via GET.
 */
export async function captureMultiSellerOrder(
  userId: string,
  internalOrderId: string,
): Promise<CaptureResult> {
  if (!isPayPalConfigured()) throw new PayPalNotConfiguredError()

  const supabase = createServiceClient()

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, status, paypal_order_id, paypal_payer_id, paypal_payer_email')
    .eq('id', internalOrderId)
    .eq('user_id', userId) // defense in depth on top of the route's session
    .maybeSingle()
  if (orderError) throw orderError
  if (!order) throw new CheckoutNotFoundError()

  // Already finalized: return the persisted state (idempotent read).
  if (order.status === 'completed' || order.status === 'partially_completed') {
    const items = await loadItemResults(supabase, order.id)
    return { internalOrderId: order.id, status: order.status, items }
  }
  if (order.status === 'canceled') {
    return { internalOrderId: order.id, status: 'canceled', items: [] }
  }

  if (!order.paypal_order_id) {
    throw new CheckoutNotFoundError('Order was never created with PayPal')
  }

  // Allowed from CREATED (buyer just approved via the JS SDK), APPROVED, and
  // 'failed' (PayPal's documented restart after INSTRUMENT_DECLINED).
  const { status, body } = await paypalRequest(
    `/v2/checkout/orders/${order.paypal_order_id}/capture`,
    { method: 'POST', body: {}, requestId: `capture-${order.id}` },
  )

  if (status === 504) {
    // PayPal may still complete every unit; reconcile from the order
    // resource instead of failing the checkout outright.
    const orderBody = await fetchPayPalOrder(order.paypal_order_id)
    if (orderBody) {
      const paypalStatus =
        typeof orderBody.status === 'string' ? orderBody.status : 'CREATED'
      const terminal =
        paypalStatus === 'COMPLETED' ||
        paypalStatus === 'PARTIALLY_COMPLETED' ||
        paypalStatus === 'VOIDED'
      if (terminal) {
        return persistCapture(supabase, order, orderBody)
      }
      // The order exists but PayPal has not finalized the capture yet. Do not
      // report 'failed' (which says "nothing was charged"); tell the client to
      // keep polling/reconciling.
      return {
        internalOrderId: order.id,
        status: orderStatusFromPayPal(paypalStatus),
        items: [],
        processing: true,
      }
    }
    return {
      internalOrderId: order.id,
      status: orderStatusFromPayPal('CREATED'),
      items: [],
      processing: true,
    }
  }

  if (status === 422) {
    const declined = declinedRefsFrom422(body as { details?: Array<{ field?: string }> })
    const items = await persistItemStatuses(supabase, order.id, declined)
    await updateOrder(supabase, order.id, {
      status: 'failed',
      error: 'No purchase unit was captured (buyer restart required)',
    })
    return { internalOrderId: order.id, status: 'failed', items }
  }

  if (status < 200 || status >= 300) {
    throw new PayPalApiError(status, body, `PayPal capture failed (HTTP ${status})`)
  }

  return persistCapture(supabase, order, body)
}

// --- persistence helpers -----------------------------------------------------

async function persistCapture(
  supabase: ReturnType<typeof createServiceClient>,
  order: OrderRow,
  orderBody: unknown,
): Promise<CaptureResult> {
  const shaped = orderBody as { status?: string; payer?: { payer_id?: string; email_address?: string } }
  const byRef = captureUnitsFromOrder(orderBody as Parameters<typeof captureUnitsFromOrder>[0])
  const items = await persistItemResults(supabase, order.id, byRef)

  const orderStatus = orderStatusFromPayPal(shaped?.status ?? 'CREATED')
  await updateOrder(supabase, order.id, {
    status: orderStatus,
    paypal_payer_id: shaped?.payer?.payer_id ?? null,
    paypal_payer_email: shaped?.payer?.email_address ?? null,
  })
  return { internalOrderId: order.id, status: orderStatus, items }
}

async function persistItemResults(
  supabase: ReturnType<typeof createServiceClient>,
  orderId: string,
  byRef: Map<string, CaptureItemResult>,
): Promise<CaptureItemResult[]> {
  const rows = await loadRows(supabase, orderId)
  const results: CaptureItemResult[] = []
  for (const row of rows) {
    const capture = byRef.get(row.purchase_ref)
    if (!capture) {
      results.push({
        purchaseRef: row.purchase_ref,
        captureId: null,
        captureStatus: null,
        netAmount: null,
      })
      continue
    }
    const { error } = await supabase
      .from('order_items')
      .update({
        paypal_capture_id: capture.captureId,
        capture_status: capture.captureStatus,
        net_amount: capture.netAmount,
      })
      .eq('id', row.id)
    if (error) throw error
    results.push(capture)
  }
  return results
}

// 422 path: mark each named unit DECLINED; unnamed units stay uncaptured.
async function persistItemStatuses(
  supabase: ReturnType<typeof createServiceClient>,
  orderId: string,
  declinedRefs: string[],
): Promise<CaptureItemResult[]> {
  const rows = await loadRows(supabase, orderId)
  const results: CaptureItemResult[] = []
  for (const row of rows) {
    if (declinedRefs.includes(row.purchase_ref)) {
      const { error } = await supabase
        .from('order_items')
        .update({ capture_status: 'DECLINED' })
        .eq('id', row.id)
      if (error) throw error
      results.push({ purchaseRef: row.purchase_ref, captureId: null, captureStatus: 'DECLINED', netAmount: null })
    } else {
      results.push({ purchaseRef: row.purchase_ref, captureId: null, captureStatus: null, netAmount: null })
    }
  }
  return results
}

async function loadItemResults(
  supabase: ReturnType<typeof createServiceClient>,
  orderId: string,
): Promise<CaptureItemResult[]> {
  const rows = await loadRows(supabase, orderId)
  return rows.map((row) => ({
    purchaseRef: row.purchase_ref,
    captureId: row.paypal_capture_id,
    captureStatus: (row.capture_status ?? null) as CaptureItemResult['captureStatus'],
    netAmount: row.net_amount,
  }))
}

async function loadRows(
  supabase: ReturnType<typeof createServiceClient>,
  orderId: string,
): Promise<Array<Pick<Tables<'order_items'>, 'id' | 'purchase_ref' | 'paypal_capture_id' | 'capture_status' | 'net_amount'>>> {
  const { data, error } = await supabase
    .from('order_items')
    .select('id, purchase_ref, paypal_capture_id, capture_status, net_amount')
    .eq('order_id', orderId)
  if (error) throw error
  return data ?? []
}

async function updateOrder(
  supabase: ReturnType<typeof createServiceClient>,
  orderId: string,
  patch: Partial<Pick<Tables<'orders'>, 'status' | 'error' | 'paypal_payer_id' | 'paypal_payer_email'>>,
): Promise<void> {
  const { error } = await supabase
    .from('orders')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', orderId)
  if (error) throw error
}

async function fetchPayPalOrder(
  paypalOrderId: string,
): Promise<Record<string, unknown> | null> {
  const { status, body } = await paypalRequest(`/v2/checkout/orders/${paypalOrderId}`, {
    method: 'GET',
  })
  if (status < 200 || status >= 300) return null
  return body as Record<string, unknown>
}
