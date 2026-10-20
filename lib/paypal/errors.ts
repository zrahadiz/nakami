// Checkout error taxonomy. Route handlers map these to HTTP codes:
//   CheckoutValidationError -> 400   CheckoutNotFoundError -> 404
//   PayPalNotConfiguredError / UnresolvedMerchantError -> 503
//   PayPalApiError -> 502 (full PayPal body stays in server logs)

export class CheckoutValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CheckoutValidationError'
  }
}

export class CheckoutNotFoundError extends Error {
  constructor(message = 'Order not found') {
    super(message)
    this.name = 'CheckoutNotFoundError'
  }
}

export class PayPalNotConfiguredError extends Error {
  constructor(
    message = 'PayPal is not configured: set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET',
  ) {
    super(message)
    this.name = 'PayPalNotConfiguredError'
  }
}

export class UnresolvedMerchantError extends Error {
  readonly productIds: string[]
  constructor(productIds: string[]) {
    super(
      'No PayPal merchant mapped for: ' + productIds.join(', ') +
        ' (add merchants to scripts/paypal-merchants.json)',
    )
    this.name = 'UnresolvedMerchantError'
    this.productIds = productIds
  }
}

export class PayPalApiError extends Error {
  readonly status: number
  readonly body: unknown
  constructor(status: number, body: unknown, message?: string) {
    super(message ?? describeApiError(status, body))
    this.name = 'PayPalApiError'
    this.status = status
    this.body = body
  }

  // First named issue from a PayPal error body (e.g. INSTRUMENT_DECLINED),
  // falling back to the error name. Used for the client-facing summary.
  get issue(): string | null {
    const body = this.body as { name?: string; details?: Array<{ issue?: string }> } | null
    return body?.details?.find((detail) => detail.issue)?.issue ?? body?.name ?? null
  }
}

function describeApiError(status: number, body: unknown): string {
  const shaped = body as { name?: string; message?: string } | null
  return (
    `PayPal API error (HTTP ${status})` +
    (shaped?.name ? `: ${shaped.name}` : '') +
    (shaped?.message ? ` — ${shaped.message}` : '')
  )
}
