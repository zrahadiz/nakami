// Pure interpreters for PayPal order/capture responses and webhook item
// states. No `server-only` here: bun tests import these directly with
// fixtures trimmed from the official multi-seller payments docs.

import type { CaptureItemResult, CaptureStatus, OrderStatus } from './types'

// Map a PayPal order status onto orders.status (DB check-constrained union).
// CREATED and anything unknown fall back to 'created' (order still open).
export function orderStatusFromPayPal(paypalStatus: string): OrderStatus {
  switch (paypalStatus) {
    case 'APPROVED':
      return 'approved'
    case 'COMPLETED':
      return 'completed'
    case 'PARTIALLY_COMPLETED':
      return 'partially_completed'
    case 'VOIDED':
      return 'canceled'
    case 'CREATED':
    default:
      return 'created'
  }
}

export function normalizeCaptureStatus(status?: string): CaptureStatus | null {
  switch (status) {
    case 'COMPLETED':
    case 'DECLINED':
    case 'PENDING':
    case 'VOIDED':
    case 'PARTIALLY_COMPLETED':
      return status
    default:
      return null
  }
}

function parseAmount(value?: string): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

type CaptureLike = {
  id?: string
  status?: string
  seller_receivable_breakdown?: { net_amount?: { value?: string } }
}

type OrderBody = {
  purchase_units?: Array<{
    reference_id?: string
    payments?: { captures?: CaptureLike[] }
  }>
}

/**
 * Extract per-unit capture facts from an order resource. Create, capture and
 * GET responses all carry purchase_units[], so one reader covers all three.
 */
export function captureUnitsFromOrder(body: OrderBody): Map<string, CaptureItemResult> {
  const byRef = new Map<string, CaptureItemResult>()
  for (const unit of body?.purchase_units ?? []) {
    const referenceId = unit?.reference_id
    if (!referenceId) continue
    const capture = unit?.payments?.captures?.[0]
    byRef.set(referenceId, {
      purchaseRef: referenceId,
      captureId: capture?.id ?? null,
      captureStatus: normalizeCaptureStatus(capture?.status),
      netAmount: parseAmount(capture?.seller_receivable_breakdown?.net_amount?.value),
    })
  }
  return byRef
}

/**
 * HTTP 422 from capture means NO purchase unit was captured; details[] names
 * each failing unit as field: "/purchase_units/@reference_id=='REFID-1'".
 */
export function declinedRefsFrom422(body: {
  // Full detail objects carry issue/description too; only `field` matters here.
  details?: Array<{ field?: string; [key: string]: unknown }>
  [key: string]: unknown
}): string[] {
  const refs: string[] = []
  for (const detail of body?.details ?? []) {
    const match = /@reference_id=='([^']+)'/.exec(detail?.field ?? '')
    if (match) refs.push(match[1])
  }
  return refs
}

/**
 * Derive orders.status from per-item capture statuses. Returns null while the
 * stream is incomplete (any item still uncaptured or PENDING) so webhooks and
 * retries do not finalize the order too early.
 */
export function deriveOrderStatusFromItems(
  items: Array<{ captureStatus?: string | null }>,
): OrderStatus | null {
  if (items.length === 0 || items.some((item) => !item.captureStatus)) return null
  if (items.some((item) => item.captureStatus === 'PENDING')) return null
  const completed = items.filter((item) => item.captureStatus === 'COMPLETED').length
  if (completed === items.length) return 'completed'
  if (completed > 0) return 'partially_completed'
  return 'failed'
}
