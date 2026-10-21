// Pure helpers for the PayPal JS SDK merchant-id list.
//
// The SDK validates the created order against the SDK script's merchant-id
// list with SET EQUALITY, not as an allow-list: if the list has two sellers
// and the order pays one, it rejects the order. The script list and the order
// payees must therefore be the exact same set, and the script must be
// remounted whenever that set changes.

/** Trim, drop blanks, dedupe and sort so comparisons are order-independent. */
export function normalizeMerchantIds(ids: readonly string[]): string[] {
  const unique = new Set<string>()
  for (const id of ids) {
    const trimmed = id.trim()
    if (trimmed) unique.add(trimmed)
  }
  return [...unique].sort()
}

/** True when both lists contain exactly the same merchant ids. */
export function sameMerchantIds(
  a: readonly string[],
  b: readonly string[],
): boolean {
  const left = normalizeMerchantIds(a)
  const right = normalizeMerchantIds(b)
  return left.length === right.length && left.every((id, i) => id === right[i])
}

/**
 * A stable, valid `data-namespace` for one merchant set. A namespace per set
 * lets a new SDK script load without colliding with the previous
 * `window.paypal` (the SDK refuses to load two scripts into one namespace).
 */
export function merchantNamespace(ids: readonly string[]): string {
  const normalized = normalizeMerchantIds(ids)
  const key = normalized.join(',')
  let hash = 2166136261
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  // Readable prefix for DevTools, hash suffix to make collisions impossible.
  const readable =
    normalized
      .join('_')
      .replace(/[^A-Za-z0-9_]/g, '_')
      .slice(0, 40) || 'default'
  return `paypal_sdk_${readable}_${(hash >>> 0).toString(36)}`
}
