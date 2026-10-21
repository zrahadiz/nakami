import 'server-only'
import { PayPalApiError, PayPalNotConfiguredError } from './errors'

// PayPal REST client for the Orders/Payments/webhook-verification flows we
// use, built on plain fetch: the official TypeScript Server SDK would pull in
// its full runtime for five endpoints, and webhook signature verification has
// no SDK controller at all — one small fetch layer covers all of it.
//
// Mirrors lib/channel3.ts: server-only module, env-gated, typed at the edges.

export type PayPalEnv = 'sandbox' | 'live'

export interface PayPalConfig {
  env: PayPalEnv
  base: string
  clientId: string
  clientSecret: string
  /** PayPal-Partner-Attribution-Id header (BN code) for platform attribution. */
  bnCode?: string
  /** Webhook id for /v1/notifications/verify-webhook-signature. */
  webhookId?: string
}

// Like CHANNEL3_API_KEY: the app works without PayPal; checkout routes
// answer 503 until the platform credentials exist.
export function isPayPalConfigured(): boolean {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET)
}

/** Which PayPal environment this deployment talks to. */
export function getPayPalEnv(): PayPalEnv {
  return process.env.PAYPAL_ENV === 'live' ? 'live' : 'sandbox'
}

export function getPayPalConfig(): PayPalConfig {
  const clientId = process.env.PAYPAL_CLIENT_ID
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new PayPalNotConfiguredError()
  const env = getPayPalEnv()
  return {
    env,
    base:
      env === 'live'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com',
    clientId,
    clientSecret,
    bnCode: process.env.PAYPAL_BN_CODE || undefined,
    webhookId: process.env.PAYPAL_WEBHOOK_ID || undefined,
  }
}

const TIMEOUT_MS = 30_000

// --- OAuth token (client_credentials grant) --------------------------------
// Module-level cache: Fluid compute keeps instances warm, so this saves a
// token round trip per request. Client credentials only — it never carries
// user identity, unlike the cookie-bound Supabase clients.
let cachedToken: { token: string; expiresAt: number } | null = null
let inflightToken: Promise<string> | null = null

async function fetchAccessToken(config: PayPalConfig): Promise<string> {
  const response = await fetch(`${config.base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    throw new PayPalApiError(response.status, body, 'Failed to fetch PayPal access token')
  }
  const token = (body as { access_token?: unknown })?.access_token
  const expiresIn = Number((body as { expires_in?: unknown })?.expires_in) || 0
  if (typeof token !== 'string' || expiresIn <= 0) {
    throw new PayPalApiError(response.status, body, 'PayPal token response is missing access_token')
  }
  // Refresh five minutes early so a token never expires mid-request.
  cachedToken = { token, expiresAt: Date.now() + (expiresIn - 300) * 1000 }
  return token
}

export async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token
  // Serialize refreshes so concurrent requests share one token round trip.
  if (!inflightToken) {
    inflightToken = fetchAccessToken(getPayPalConfig()).finally(() => {
      inflightToken = null
    })
  }
  return inflightToken
}

// --- Requests ---------------------------------------------------------------

export interface PayPalRequest {
  method?: 'GET' | 'POST'
  body?: unknown
  /**
   * PayPal-Request-Id: idempotency key. PayPal stores it for 6 hours, so a
   * retried create/capture cannot double-charge the buyer.
   */
  requestId?: string
  /** PayPal-Mock-Response: sandbox negative testing (documented header). */
  mockResponse?: string
  headers?: Record<string, string>
}

export async function paypalRequest(
  path: string,
  request: PayPalRequest = {},
): Promise<{ status: number; body: unknown }> {
  const config = getPayPalConfig()
  const headers: Record<string, string> = {
    Authorization: `Bearer ${await getAccessToken()}`,
    'Content-Type': 'application/json',
    ...request.headers,
  }
  if (config.bnCode) headers['PayPal-Partner-Attribution-Id'] = config.bnCode
  if (request.requestId) headers['PayPal-Request-Id'] = request.requestId
  if (request.mockResponse) headers['PayPal-Mock-Response'] = request.mockResponse

  let response: Response
  try {
    response = await fetch(`${config.base}${path}`, {
      method: request.method ?? 'POST',
      headers,
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (err) {
    throw new PayPalApiError(0, err, `PayPal request failed: ${path}`)
  }

  const body: unknown =
    response.status === 204 ? null : await response.json().catch(() => null)
  return { status: response.status, body }
}

// Turn a paypalRequest result into a thrown PayPalApiError for non-2xx.
// Capture intentionally skips this: 207/422/504 are documented outcomes the
// capture module interprets instead.
export function ensureOk(
  result: { status: number; body: unknown },
  context: string,
): unknown {
  if (result.status < 200 || result.status >= 300) {
    throw new PayPalApiError(result.status, result.body, context)
  }
  return result.body
}
