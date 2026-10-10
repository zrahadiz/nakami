import { Channel3, type Channel3Api } from '@channel3/sdk'
import type { Product, SearchFilters } from './types'
import { searchLocalCatalog } from './fallback-catalog'
import { rememberProducts } from './product-registry'

// Server-only module: reads CHANNEL3_API_KEY. Never import from client components.

const SEARCH_LIMIT = 20 // Channel3 default is 20; max is 30.
const REQUEST_TIMEOUT_SECONDS = 10 // Fail over to the local catalog quickly.

/**
 * Search for products via Channel3, falling back to the local catalog when
 * Channel3 is unavailable (missing key, network error, API failure).
 * Always resolves to Product[] — no Channel3 types leak past this module.
 */
export async function searchProducts(
  query: string,
  filters?: SearchFilters
): Promise<Product[]> {
  const apiKey = process.env.CHANNEL3_API_KEY
  if (!apiKey) {
    console.warn('CHANNEL3_API_KEY is not set; using fallback catalog')
    return searchLocalCatalog(query, filters)
  }
  if (query.trim() === '') {
    // Channel3 rejects requests with no query (422); go straight to the catalog.
    return searchLocalCatalog(query, filters)
  }

  try {
    const client = new Channel3({
      apiKey,
      timeoutInSeconds: REQUEST_TIMEOUT_SECONDS,
    })
    const page = await client.products.search({
      query,
      limit: SEARCH_LIMIT,
      filters: toChannel3Filters(filters),
    })
    const products = page.response.products
    // Expose category context so id-only tools (estimate_dimensions) can resolve it.
    rememberProducts(
      products.map((product) => ({
        id: product.id,
        title: product.title,
        category: product.category?.title ?? product.category?.slug ?? null,
      }))
    )
    return products.map(mapChannel3Product)
  } catch (err) {
    console.warn('Channel3 unavailable, using fallback catalog', err)
    return searchLocalCatalog(query, filters)
  }
}

// Exported for tests: exercises the nullable-field handling with fixtures.
export function mapChannel3Product(product: Channel3Api.Product): Product {
  const offer = pickBestOffer(product.offers)
  const image = pickImage(product.images)

  return {
    id: product.id,
    title: product.title,
    imageUrl: image?.cleaned_url ?? image?.url ?? '',
    price:
      offer && Number.isFinite(offer.price?.price)
        ? { amount: offer.price.price, currency: offer.price.currency }
        : null,
    retailer: offer?.domain ?? product.brands?.[0]?.name ?? 'Unknown',
    availability: offer ? mapAvailability(offer.availability) : 'Unknown',
    url: offer?.url ?? '',
  }
}

function pickBestOffer(
  offers?: Channel3Api.ProductOffer[] | null
): Channel3Api.ProductOffer | null {
  if (!offers || offers.length === 0) return null
  // Prefer in-stock offers; among them (or as a fallback, among all), the cheapest.
  const inStock = offers.filter((offer) => offer.availability === 'InStock')
  const pool = inStock.length > 0 ? inStock : offers
  return pool.reduce((best, offer) =>
    offer.price.price < best.price.price ? offer : best
  )
}

function pickImage(
  images?: Channel3Api.ProductImage[] | null
): Channel3Api.ProductImage | null {
  if (!images || images.length === 0) return null
  return images.find((image) => image.is_main_image) ?? images[0]
}

// The public API only emits InStock/OutOfStock; the shared type keeps the wider
// union (also used by the local catalog) for UI states.
function mapAvailability(
  status: Channel3Api.OfferAvailabilityStatus | null | undefined
): Product['availability'] {
  switch (status) {
    case 'InStock':
      return 'InStock'
    case 'OutOfStock':
      return 'SoldOut'
    default:
      return 'Unknown'
  }
}

function toChannel3Filters(
  filters?: SearchFilters
): Channel3Api.SearchFilters | undefined {
  if (!filters) return undefined
  const result: Channel3Api.SearchFilters = {}
  if (filters.category) result.category_ids = [filters.category]
  const price: Channel3Api.SearchFilterPrice = {}
  if (filters.minPrice != null) price.min_price = filters.minPrice
  if (filters.maxPrice != null) price.max_price = filters.maxPrice
  if (Object.keys(price).length > 0) result.price = price
  return result.category_ids || result.price ? result : undefined
}
