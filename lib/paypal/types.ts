// Shared checkout types (plan: docs/plans/paypal-multiseller-checkout.md).
//
// The flow is PayPal's documented "multi-seller payments" feature: ONE Orders
// v2 order whose `purchase_units` carry one unit PER PRODUCT, each paying that
// product's own merchant account ("payee"). `createMultiSellerOrder` is our
// server-side wrapper name for that flow — PayPal ships no SDK method by that
// exact name (verified against the Server SDK v2 docs and the official guide).

// A PayPal business account that receives funds (sandbox or live).
export interface Payee {
  merchantId: string
  /** Optional: payee_email. Sandbox business accounts always have one. */
  email?: string | null
}

// One checked-out product, as sent by the board. Prices are plain numbers.
export interface CheckoutItemInput {
  productId: string
  title: string
  retailer: string
  price: number
  /** USD only for the demo; anything else is rejected during validation. */
  currency?: string
  quantity?: number
  /** Board slot key (e.g. "Floor lamp"); informational. */
  slot?: string | null
}

// Purchase-unit payload we send to PayPal (the subset we rely on).
export interface PurchaseUnit {
  /** PayPal requires reference_id on every unit when there are several. */
  referenceId: string
  /** Pass-through id echoed by webhooks — equal to referenceId for us. */
  customId: string
  payee: Payee
  /** Exactly two decimals, as PayPal requires. */
  amount: { currency: 'USD'; value: string }
}

// orders.status — kept in sync with the DB check constraint in the
// paypal_multiseller_checkout migration.
export type OrderStatus =
  | 'created'
  | 'approved'
  | 'completed'
  | 'partially_completed'
  | 'failed'
  | 'canceled'

// payments.captures[].status values a multi-seller capture can produce.
export type CaptureStatus =
  | 'COMPLETED'
  | 'DECLINED'
  | 'PENDING'
  | 'VOIDED'
  | 'PARTIALLY_COMPLETED'

export interface MultiSellerOrderResult {
  internalOrderId: string
  paypalOrderId: string
  status: OrderStatus
  /** Unique payee merchant ids — passed to the JS SDK (merchant-id param). */
  merchantIds: string[]
}

export interface CaptureItemResult {
  purchaseRef: string
  captureId: string | null
  captureStatus: CaptureStatus | null
  netAmount: number | null
}

export interface CaptureResult {
  internalOrderId: string
  status: OrderStatus
  items: CaptureItemResult[]
  /**
   * True when PayPal is still processing the capture (HTTP 504) and the final
   * state is not yet known — the UI should re-poll instead of failing.
   */
  processing?: boolean
}
