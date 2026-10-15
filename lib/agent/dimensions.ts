import type { DimensionEstimate } from '@/lib/types'
import { getProductContext, type ProductContext } from '@/lib/product-registry'

// Week 1 heuristic: a static bounding box per category, in centimeters.
// Later tickets can replace this with real dimensions from Channel3 offers
// (ProductOffer.dimensions) or an LLM vision pass.
interface BoundingBox {
  length: number
  width: number
  height: number
}

const DIMENSION_TABLE = new Map<string, BoundingBox>([
  ['armchair', { length: 85, width: 80, height: 90 }],
  ['sofa', { length: 210, width: 90, height: 80 }],
  ['loveseat', { length: 150, width: 85, height: 80 }],
  ['ottoman', { length: 60, width: 60, height: 40 }],
  ['bench', { length: 120, width: 40, height: 45 }],
  ['floor lamp', { length: 40, width: 40, height: 160 }],
  ['table lamp', { length: 30, width: 30, height: 55 }],
  ['pendant light', { length: 45, width: 45, height: 40 }],
  ['coffee table', { length: 110, width: 60, height: 42 }],
  ['side table', { length: 45, width: 45, height: 55 }],
  ['dining table', { length: 180, width: 90, height: 75 }],
  ['rug', { length: 240, width: 170, height: 2 }],
  ['bookshelf', { length: 90, width: 35, height: 180 }],
  ['sideboard', { length: 160, width: 45, height: 80 }],
  ['wall art', { length: 90, width: 4, height: 60 }],
  ['mirror', { length: 60, width: 4, height: 120 }],
  ['vase', { length: 20, width: 20, height: 35 }],
  ['plant', { length: 45, width: 45, height: 120 }],
])

const DEFAULT_BOX: BoundingBox = { length: 60, width: 60, height: 75 }

// Match compound keys ("coffee table") before their generic parts.
const KEYS_BY_SPECIFICITY = [...DIMENSION_TABLE.keys()].sort(
  (a, b) => b.length - a.length
)

// Resolves the heuristic category from the product registry: the category first
// (Channel3 title/slug or catalog category), then the title as a keyword source.
function resolveCategory(
  context: ProductContext | null
): { key: string; box: BoundingBox } | null {
  if (!context) return null

  for (const raw of [context.category, context.title]) {
    if (!raw) continue
    const normalized = raw.toLowerCase().trim()

    const exact = DIMENSION_TABLE.get(normalized)
    if (exact) return { key: normalized, box: exact }

    for (const key of KEYS_BY_SPECIFICITY) {
      // Any key inside the value ("leather armchair" -> armchair), or a short
      // value inside a longer key ("chair" -> armchair). The length guard keeps
      // one-letter nonsense from matching everything.
      if (
        normalized.includes(key) ||
        (normalized.length >= 3 && key.includes(normalized))
      ) {
        return { key, box: DIMENSION_TABLE.get(key)! }
      }
    }
  }

  // Generic words the table has no key for: "Walnut Lounge Chair" and
  // "Bouclé Accent Chair" share the armchair box.
  if (/chair/.test(context.title.toLowerCase())) {
    return { key: 'armchair', box: DIMENSION_TABLE.get('armchair')! }
  }
  return null
}

/**
 * Estimate bounding boxes for products by ID. Uses the category recorded when
 * the product was returned by searchProducts; unknown IDs get the default box
 * with `category: null` so callers can tell the difference.
 */
export function estimateDimensionsForProducts(
  productIds: string[]
): DimensionEstimate[] {
  return productIds.map((productId) => {
    const match = resolveCategory(getProductContext(productId))
    const box = match?.box ?? DEFAULT_BOX
    return {
      productId,
      category: match?.key ?? null,
      length: box.length,
      width: box.width,
      height: box.height,
      unit: 'cm',
    }
  })
}

/**
 * Registry-free variant for callers that already hold the product payloads
 * (the client workspace): the registry is server-local, so titles are passed
 * in explicitly instead of looked up by id.
 */
export function estimateDimensionsFromTitles(
  inputs: ReadonlyArray<{ productId: string; title: string }>
): DimensionEstimate[] {
  return inputs.map(({ productId, title }) => {
    const match = resolveCategory({ title, category: null })
    const box = match?.box ?? DEFAULT_BOX
    return {
      productId,
      category: match?.key ?? null,
      length: box.length,
      width: box.width,
      height: box.height,
      unit: 'cm',
    }
  })
}
