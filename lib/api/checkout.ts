// lib/api/checkout.ts
//
// All /api/checkout/* requests, on your configured axios instance
// (baseURL '/api', cookies, 401 redirect). The UI never calls fetch directly.

import axios from 'axios'

import { api } from '@/lib/api/axios'
import type { CaptureResult, CheckoutItemInput } from '@/lib/paypal/types'

/* ---------- types ---------- */

export type CheckoutConfig = {
  configured: boolean
  env?: string
  clientId?: string
}

export type CheckoutRequest = {
  threadId: string | null
  items: CheckoutItemInput[]
}

export type CheckoutOrder = {
  /** Our own order id, used for the capture call. */
  internalOrderId: string
  /** The PayPal order id returned to the PayPal buttons. */
  paypalOrderId: string
  /**
   * Seller ids actually used by the order's purchase units. Must exactly equal
   * the ids the SDK was loaded with; used to detect a stale script before
   * PayPal's own payee validation does.
   */
  merchantIds: string[]
}

/* ---------- errors ---------- */

/** An error with a message that is safe to show to the user. */
export class CheckoutApiError extends Error {
  status?: number
  /** Products the server could not map to a seller (merchants endpoint). */
  productIds?: string[]

  constructor(message: string, status?: number, productIds?: string[]) {
    super(message)
    this.name = 'CheckoutApiError'
    this.status = status
    this.productIds = productIds
  }
}

function toCheckoutError(error: unknown, fallback: string): CheckoutApiError {
  if (error instanceof CheckoutApiError) return error

  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { error?: unknown; productIds?: unknown }
      | undefined

    const message =
      typeof data?.error === 'string' && data.error ? data.error : fallback

    const productIds = Array.isArray(data?.productIds)
      ? data.productIds.filter((id): id is string => typeof id === 'string')
      : undefined

    return new CheckoutApiError(message, error.response?.status, productIds)
  }

  return new CheckoutApiError(
    error instanceof Error && error.message ? error.message : fallback
  )
}

/** Message for the UI from anything thrown by the functions below. */
export function getCheckoutErrorMessage(error: unknown, fallback: string) {
  return toCheckoutError(error, fallback).message
}

/* ---------- requests ---------- */

// GET /api/checkout/config: is PayPal configured on the server?
export async function getCheckoutConfig(
  signal?: AbortSignal
): Promise<CheckoutConfig> {
  try {
    const { data } = await api.get<CheckoutConfig>('/checkout/config', {
      signal,
    })
    return data
  } catch (error) {
    if (axios.isCancel(error)) throw error

    // An HTTP error response means "not set up"; only network failures are real errors.
    if (axios.isAxiosError(error) && error.response) {
      return { configured: false }
    }
    throw toCheckoutError(error, 'Checkout is unavailable.')
  }
}

// POST /api/checkout/merchants: this cart's exact seller ids, which the PayPal
// SDK must be loaded with (it validates the order by set equality). The
// endpoint also validates the cart and persists first-time assignments.
export async function getCheckoutMerchants(
  input: CheckoutRequest,
  signal?: AbortSignal
): Promise<string[]> {
  try {
    const { data } = await api.post<{ merchantIds: string[] }>(
      '/checkout/merchants',
      input,
      { signal }
    )
    return data.merchantIds
  } catch (error) {
    if (axios.isCancel(error)) throw error
    throw toCheckoutError(error, 'Checkout is unavailable.')
  }
}

// POST /api/checkout/orders: create the order, returns the PayPal order id.
export async function createCheckoutOrder(
  input: CheckoutRequest
): Promise<CheckoutOrder> {
  try {
    const { data } = await api.post<CheckoutOrder>('/checkout/orders', input)
    return data
  } catch (error) {
    throw toCheckoutError(error, 'Could not start checkout.')
  }
}

// POST /api/checkout/orders/:id/capture: take the payment (idempotent on the server).
export async function captureCheckoutOrder(
  orderId: string
): Promise<CaptureResult> {
  try {
    const { data } = await api.post<CaptureResult>(
      `/checkout/orders/${encodeURIComponent(orderId)}/capture`,
      undefined,
      { timeout: 60_000 } // PayPal can be slow; the default is 30s
    )
    return data
  } catch (error) {
    throw toCheckoutError(error, 'Capture failed.')
  }
}

/**
 * Capture, and keep asking while PayPal says `processing: true` (a PayPal 504
 * means "still working", not "failed").
 */
export async function captureOrderWithRetries(
  orderId: string,
  { attempts = 3, delayMs = 2000 } = {}
): Promise<CaptureResult> {
  let last: CaptureResult | null = null

  for (let attempt = 0; attempt < attempts; attempt++) {
    last = await captureCheckoutOrder(orderId)
    if (!last.processing) return last

    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }

  // Still processing: return the last known state so the UI can say "pending"
  // instead of "failed" (which incorrectly implies nothing was charged).
  if (last) return last

  throw new CheckoutApiError('Capture did not run. Please try again.')
}