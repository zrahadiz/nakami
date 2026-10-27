import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { getPayPalConfig, paypalRequest } from './client'
import { deriveOrderStatusFromItems } from './order-interpretation'
import type { CaptureStatus } from './types'

// PayPal webhook ingestion. Events are the safety net for the JS SDK flow:
// the buyer's browser may close after approving, so APPROVED / CAPTURE.*
// events keep orders and per-item capture states truthful without the UI.

export interface PayPalWebhookEvent {
  id?: string
  event_type?: string
  resource?: {
    id?: string
    status?: string
    /** purchase_units[].custom_id — we mirror reference_id into it. */
    custom_id?: string | null
    supplementary_data?: { related_ids?: { order_id?: string } }
    seller_receivable_breakdown?: { net_amount?: { value?: string } }
  }
}

/**
 * Verify a delivery via /v1/notifications/verify-webhook-signature (PayPal's
 * recommended check). The raw body must be the exact bytes PayPal signed, so
 * the route passes the pre-parse text here.
 */
export async function verifyWebhookSignature(
  headers: Headers,
  rawBody: string,
): Promise<boolean> {
  const config = getPayPalConfig()
  if (!config.webhookId) return false

  const { body } = await paypalRequest('/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    body: {
      auth_algo: headers.get('paypal-auth-algo'),
      cert_url: headers.get('paypal-cert-url'),
      transmission_id: headers.get('paypal-transmission-id'),
      transmission_sig: headers.get('paypal-transmission-sig'),
      transmission_time: headers.get('paypal-transmission-time'),
      webhook_id: config.webhookId,
      webhook_event: JSON.parse(rawBody),
    },
  })
  return (body as { verification_status?: string } | null)?.verification_status === 'SUCCESS'
}

// Capture-status events mapped onto order_items.capture_status values.
const CAPTURE_STATUS_BY_EVENT: Record<string, CaptureStatus> = {
  'PAYMENT.CAPTURE.COMPLETED': 'COMPLETED',
  'PAYMENT.CAPTURE.DECLINED': 'DECLINED',
  'PAYMENT.CAPTURE.VOIDED': 'VOIDED',
}

/**
 * Apply one verified event. Idempotent by (paypal order id, purchase_ref):
 * replaying an event rewrites the same fields, and order status is re-derived
 * from the item states rather than incremented.
 */
export async function applyWebhookEvent(event: PayPalWebhookEvent): Promise<void> {
  const supabase = createServiceClient()
  const resource = event.resource ?? {}

  if (event.event_type === 'CHECKOUT.ORDER.APPROVED' && resource.id) {
    await supabase
      .from('orders')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('paypal_order_id', resource.id)
      // Never resurrect a failed/canceled order back to approved.
      .eq('status', 'created')
    return
  }

  const captureStatus = event.event_type ? CAPTURE_STATUS_BY_EVENT[event.event_type] : undefined
  if (!captureStatus) {
    // PAYMENT.CAPTURE.REFUNDED and other events: logged and ignored for now
    // (refunds are out of scope for the demo checkout).
    return
  }

  const paypalOrderId = resource.supplementary_data?.related_ids?.order_id
  const purchaseRef = resource.custom_id
  if (!paypalOrderId || !purchaseRef) {
    console.warn('PayPal capture webhook missing order_id/custom_id', event.event_type, resource.id)
    return
  }

  const { data: order } = await supabase
    .from('orders')
    .select('id')
    .eq('paypal_order_id', paypalOrderId)
    .maybeSingle()
  if (!order) {
    console.warn('PayPal webhook for unknown order', paypalOrderId)
    return
  }

  const netAmount = Number(resource.seller_receivable_breakdown?.net_amount?.value)
  const { error } = await supabase
    .from('order_items')
    .update({
      paypal_capture_id: resource.id ?? null,
      capture_status: captureStatus,
      ...(Number.isFinite(netAmount) ? { net_amount: netAmount } : {}),
    })
    .eq('order_id', order.id)
    .eq('purchase_ref', purchaseRef)
  if (error) throw error

  // Re-derive the order status from all items; deriveOrderStatusFromItems
  // returns null while anything is still uncaptured/pending.
  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('capture_status')
    .eq('order_id', order.id)
  if (itemsError) throw itemsError
  const derived = deriveOrderStatusFromItems(
    (items ?? []).map((item) => ({ captureStatus: item.capture_status })),
  )
  if (derived) {
    await supabase
      .from('orders')
      .update({ status: derived, updated_at: new Date().toISOString() })
      .eq('id', order.id)
  }
}
