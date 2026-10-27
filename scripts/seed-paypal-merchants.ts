import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

// Seeds product-specific mappings from scripts/paypal-merchants.json into the
// paypal_merchants table: one PayPal sandbox BUSINESS account per product
// ("payee" of the purchase unit). Idempotent (upsert on product_id), safe to
// re-run.
//
// The file can also be a plain merchant pool ({ payeeEmail, payeeMerchantId }
// only). Checkout assigns a random pool merchant to each new product and
// persists it, so in that format there is nothing to seed.
//
// Setup:
//   1. Create sandbox Business accounts on developer.paypal.com (Sandbox >
//      Accounts) and note each account's email + payer/merchant id.
//   2. Put them in scripts/paypal-merchants.json. For explicit per-product
//      mappings, also add productId + retailer per entry (see the example).
//   3. Run: bun run seed:merchants
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (Bun loads
// .env.local automatically).

interface MerchantEntry {
  productId?: string
  retailer?: string
  payeeEmail: string
  payeeMerchantId: string
  env?: string
}

async function main(): Promise<number> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY.')
    console.error('Add them to .env.local, then re-run: bun run seed:merchants')
    return 1
  }

  const file = path.join(process.cwd(), 'scripts', 'paypal-merchants.json')
  let entries: MerchantEntry[]
  try {
    entries = JSON.parse(await readFile(file, 'utf8')) as MerchantEntry[]
  } catch {
    console.error('Missing or unreadable scripts/paypal-merchants.json.')
    console.error('Copy scripts/paypal-merchants.example.json to scripts/paypal-merchants.json')
    console.error('and fill in your sandbox merchant emails + payer ids, then re-run.')
    return 1
  }

  const isMerchantPool =
    entries.length > 0 &&
    entries.every(
      (entry) =>
        !entry?.productId &&
        !entry?.retailer &&
        entry?.payeeEmail &&
        entry?.payeeMerchantId,
    )
  if (isMerchantPool) {
    console.log(
      `scripts/paypal-merchants.json contains ${entries.length} merchant account(s).`,
    )
    console.log(
      'Checkout assigns one at random to each new product and persists it; nothing to seed.',
    )
    return 0
  }

  const invalid = entries.findIndex(
    (entry) =>
      !entry?.productId ||
      !entry?.retailer ||
      !entry?.payeeEmail ||
      !entry?.payeeMerchantId,
  )
  if (entries.length === 0 || invalid !== -1) {
    console.error(
      `paypal-merchants.json: entries need payeeEmail and payeeMerchantId; ` +
        `per-product rows also need productId and retailer` +
        (invalid !== -1 ? ` (bad entry #${invalid + 1})` : ''),
    )
    return 1
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let failures = 0
  for (const entry of entries) {
    const { error } = await supabase.from('paypal_merchants').upsert(
      {
        product_id: entry.productId!,
        retailer: entry.retailer!,
        payee_email: entry.payeeEmail,
        payee_merchant_id: entry.payeeMerchantId,
        env: entry.env ?? 'sandbox',
      },
      { onConflict: 'product_id' },
    )
    if (error) {
      failures += 1
      console.error(`✗ ${entry.productId}: ${error.message}`)
    } else {
      console.log(`✓ ${entry.productId} -> ${entry.payeeMerchantId}`)
    }
  }

  const { count } = await supabase
    .from('paypal_merchants')
    .select('*', { count: 'exact', head: true })
  console.log(`\npaypal_merchants now has ${count ?? '?'} rows.`)
  console.log(
    'PayPal is unconfigured until PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are set' +
      ' (checkout routes answer 503 until then).',
  )
  return failures > 0 ? 1 : 0
}

process.exitCode = await main()
