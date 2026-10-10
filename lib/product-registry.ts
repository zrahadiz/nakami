// In-process registry of the products returned by searchProducts, so tools that
// only receive product IDs (estimate_dimensions, scene layout) can look up the
// product's title/category without re-querying Channel3.
//
// Bounded to avoid unbounded growth; entries fall out on eviction, process
// restart, or across serverless instances — callers must handle null.

export interface ProductContext {
  title: string
  // Channel3 category title/slug or fallback catalog category; null if unknown.
  category: string | null
}

const MAX_ENTRIES = 500
const contexts = new Map<string, ProductContext>()

export function rememberProducts(
  entries: Array<{ id: string } & ProductContext>
) {
  for (const { id, title, category } of entries) {
    if (!contexts.has(id) && contexts.size >= MAX_ENTRIES) {
      const oldest = contexts.keys().next().value
      if (oldest !== undefined) contexts.delete(oldest)
    }
    contexts.set(id, { title, category })
  }
}

export function getProductContext(productId: string): ProductContext | null {
  return contexts.get(productId) ?? null
}
