import type { Product, SearchFilters } from './types'
import { rememberProducts } from './product-registry'

// Local fallback catalog used when Channel3 is unavailable (missing key, network
// error, API failure). Kept interior-design-only to match the product vertical
// and keyword-rich so the agent's prompt text finds plausible matches offline.
//
// Images are placeholders; real product imagery comes from Channel3. Swap these
// for Supabase Storage URLs when the product-images bucket lands.
export interface CatalogEntry extends Product {
  category: string
  description: string
}

const img = (label: string) =>
  `https://placehold.co/600x400/e7e5e4/292524?text=${label.replace(/ /g, '+')}`

const price = (amount: number) => ({ amount, currency: 'USD' })

export const catalog: CatalogEntry[] = [
  {
    id: 'fallback-armchair-tan-leather',
    title: 'Tan Leather Armchair',
    description:
      'Mid-century leather armchair with solid walnut legs and a cushioned seat.',
    category: 'armchair',
    imageUrl: img('Tan Leather Armchair'),
    price: price(899),
    retailer: 'Ashford Home',
    availability: 'InStock',
    url: 'https://ashfordhome.example/products/tan-leather-armchair',
  },
  {
    id: 'fallback-armchair-walnut-lounge',
    title: 'Walnut Lounge Chair',
    description:
      'Angular mid-century lounge chair in oiled walnut with a woven cane back.',
    category: 'armchair',
    imageUrl: img('Walnut Lounge Chair'),
    price: price(649),
    retailer: 'Oak & Ember',
    availability: 'InStock',
    url: 'https://oakandember.example/products/walnut-lounge-chair',
  },
  {
    id: 'fallback-armchair-boucle-accent',
    title: 'Bouclé Accent Chair',
    description: 'Curved accent chair upholstered in ivory bouclé fabric.',
    category: 'armchair',
    imageUrl: img('Boucle Accent Chair'),
    price: price(520),
    retailer: 'Maison Nord',
    availability: 'LimitedAvailability',
    url: 'https://maisonnord.example/products/boucle-accent-chair',
  },
  {
    id: 'fallback-sofa-emerald-velvet',
    title: 'Emerald Velvet Sofa',
    description:
      'Three-seat velvet sofa in deep emerald with brass-tipped legs.',
    category: 'sofa',
    imageUrl: img('Emerald Velvet Sofa'),
    price: price(1499),
    retailer: 'Maison Nord',
    availability: 'InStock',
    url: 'https://maisonnord.example/products/emerald-velvet-sofa',
  },
  {
    id: 'fallback-sofa-charcoal-3-seat',
    title: 'Charcoal 3-Seat Sofa',
    description:
      'Low-profile sofa in charcoal performance weave with feather-blend cushions.',
    category: 'sofa',
    imageUrl: img('Charcoal 3-Seat Sofa'),
    price: price(1180),
    retailer: 'Loft Supply Co.',
    availability: 'InStock',
    url: 'https://loftsupply.example/products/charcoal-3-seat-sofa',
  },
  {
    id: 'fallback-sofa-compact-loveseat',
    title: 'Compact Loveseat',
    description: 'Two-seat loveseat in warm grey with tapered oak legs.',
    category: 'sofa',
    imageUrl: img('Compact Loveseat'),
    price: price(790),
    retailer: 'Ashford Home',
    availability: 'LimitedAvailability',
    url: 'https://ashfordhome.example/products/compact-loveseat',
  },
  {
    id: 'fallback-ottoman-woven-rattan',
    title: 'Woven Rattan Ottoman',
    description: 'Hand-woven rattan ottoman that doubles as a side table.',
    category: 'ottoman',
    imageUrl: img('Woven Rattan Ottoman'),
    price: price(210),
    retailer: 'Loft Supply Co.',
    availability: 'InStock',
    url: 'https://loftsupply.example/products/woven-rattan-ottoman',
  },
  {
    id: 'fallback-bench-saddle-leather',
    title: 'Saddle Leather Bench',
    description: 'Entryway bench in saddle leather with a blackened steel frame.',
    category: 'bench',
    imageUrl: img('Saddle Leather Bench'),
    price: price(340),
    retailer: 'Oak & Ember',
    availability: 'InStock',
    url: 'https://oakandember.example/products/saddle-leather-bench',
  },
  {
    id: 'fallback-floor-lamp-brass-arc',
    title: 'Brass Arc Floor Lamp',
    description:
      'Arched floor lamp in antique brass with a marble base and linen shade.',
    category: 'floor lamp',
    imageUrl: img('Brass Arc Floor Lamp'),
    price: price(189),
    retailer: 'Ashford Home',
    availability: 'InStock',
    url: 'https://ashfordhome.example/products/brass-arc-floor-lamp',
  },
  {
    id: 'fallback-floor-lamp-tripod',
    title: 'Tripod Floor Lamp',
    description: 'Mid-century tripod floor lamp in walnut with a drum shade.',
    category: 'floor lamp',
    imageUrl: img('Tripod Floor Lamp'),
    price: price(240),
    retailer: 'Loft Supply Co.',
    availability: 'InStock',
    url: 'https://loftsupply.example/products/tripod-floor-lamp',
  },
  {
    id: 'fallback-table-lamp-ceramic',
    title: 'Ceramic Table Lamp',
    description: 'Hand-glazed ceramic table lamp in sand with a woven cord.',
    category: 'table lamp',
    imageUrl: img('Ceramic Table Lamp'),
    price: price(95),
    retailer: 'Maison Nord',
    availability: 'InStock',
    url: 'https://maisonnord.example/products/ceramic-table-lamp',
  },
  {
    id: 'fallback-pendant-smoked-glass',
    title: 'Smoked Glass Pendant',
    description: 'Smoked glass globe pendant with brushed brass hardware.',
    category: 'pendant light',
    imageUrl: img('Smoked Glass Pendant'),
    price: price(260),
    retailer: 'Atelier Blanc',
    availability: 'InStock',
    url: 'https://atelierblanc.example/products/smoked-glass-pendant',
  },
  {
    id: 'fallback-pendant-rattan',
    title: 'Rattan Pendant Light',
    description:
      'Oversized woven rattan pendant that casts warm, patterned light.',
    category: 'pendant light',
    imageUrl: img('Rattan Pendant Light'),
    price: price(150),
    retailer: 'Loft Supply Co.',
    availability: 'InStock',
    url: 'https://loftsupply.example/products/rattan-pendant-light',
  },
  {
    id: 'fallback-coffee-table-oak',
    title: 'Oak Coffee Table',
    description:
      'Solid oak coffee table with a lower shelf for books and magazines.',
    category: 'coffee table',
    imageUrl: img('Oak Coffee Table'),
    price: price(430),
    retailer: 'Oak & Ember',
    availability: 'InStock',
    url: 'https://oakandember.example/products/oak-coffee-table',
  },
  {
    id: 'fallback-coffee-table-marble',
    title: 'Marble-Top Coffee Table',
    description:
      'Round coffee table with a honed marble top and a bronze pedestal.',
    category: 'coffee table',
    imageUrl: img('Marble-Top Coffee Table'),
    price: price(620),
    retailer: 'Maison Nord',
    availability: 'InStock',
    url: 'https://maisonnord.example/products/marble-top-coffee-table',
  },
  {
    id: 'fallback-side-table-smoked-oak',
    title: 'Round Side Table',
    description: 'Compact side table in smoked oak with a lipped edge.',
    category: 'side table',
    imageUrl: img('Round Side Table'),
    price: price(180),
    retailer: 'Ashford Home',
    availability: 'InStock',
    url: 'https://ashfordhome.example/products/round-side-table',
  },
  {
    id: 'fallback-dining-table-solid-oak',
    title: 'Solid Oak Dining Table',
    description: 'Six-seat dining table in solid white oak with a natural finish.',
    category: 'dining table',
    imageUrl: img('Solid Oak Dining Table'),
    price: price(980),
    retailer: 'Oak & Ember',
    availability: 'InStock',
    url: 'https://oakandember.example/products/solid-oak-dining-table',
  },
  {
    id: 'fallback-rug-persian-vintage',
    title: 'Vintage Persian-Style Rug',
    description:
      'Distressed Persian-style rug in faded terracotta and indigo, 5x8.',
    category: 'rug',
    imageUrl: img('Vintage Persian-Style Rug'),
    price: price(340),
    retailer: 'Ashford Home',
    availability: 'InStock',
    url: 'https://ashfordhome.example/products/vintage-persian-rug',
  },
  {
    id: 'fallback-rug-jute-handwoven',
    title: 'Hand-Woven Jute Rug',
    description: 'Natural jute rug with a braided border, 6x9.',
    category: 'rug',
    imageUrl: img('Hand-Woven Jute Rug'),
    price: price(290),
    retailer: 'Loft Supply Co.',
    availability: 'InStock',
    url: 'https://loftsupply.example/products/hand-woven-jute-rug',
  },
  {
    id: 'fallback-rug-wool-charcoal',
    title: 'Charcoal Wool Rug',
    description:
      'Dense wool rug in charcoal with a subtle geometric pattern, 5x8.',
    category: 'rug',
    imageUrl: img('Charcoal Wool Rug'),
    price: price(410),
    retailer: 'Maison Nord',
    availability: 'InStock',
    url: 'https://maisonnord.example/products/charcoal-wool-rug',
  },
  {
    id: 'fallback-bookshelf-mid-century',
    title: 'Mid-Century Bookshelf',
    description: 'Three-tier bookshelf in walnut with angled supports.',
    category: 'bookshelf',
    imageUrl: img('Mid-Century Bookshelf'),
    price: price(450),
    retailer: 'Oak & Ember',
    availability: 'SoldOut',
    url: 'https://oakandember.example/products/mid-century-bookshelf',
  },
  {
    id: 'fallback-sideboard-walnut',
    title: 'Walnut Sideboard',
    description:
      'Mid-century sideboard in walnut with brass pulls and adjustable shelving.',
    category: 'sideboard',
    imageUrl: img('Walnut Sideboard'),
    price: price(860),
    retailer: 'Ashford Home',
    availability: 'InStock',
    url: 'https://ashfordhome.example/products/walnut-sideboard',
  },
  {
    id: 'fallback-wall-art-abstract-canvas',
    title: 'Abstract Canvas Wall Art',
    description: 'Framed abstract canvas print in warm earth tones, 24x36.',
    category: 'wall art',
    imageUrl: img('Abstract Canvas Wall Art'),
    price: price(120),
    retailer: 'Atelier Blanc',
    availability: 'InStock',
    url: 'https://atelierblanc.example/products/abstract-canvas-wall-art',
  },
  {
    id: 'fallback-mirror-arch-brass',
    title: 'Arch Wall Mirror',
    description: 'Arched wall mirror with a thin brass frame.',
    category: 'mirror',
    imageUrl: img('Arch Wall Mirror'),
    price: price(165),
    retailer: 'Maison Nord',
    availability: 'InStock',
    url: 'https://maisonnord.example/products/arch-wall-mirror',
  },
  {
    id: 'fallback-vase-stoneware',
    title: 'Stoneware Vase',
    description: 'Matte stoneware vase in chalk white with a narrow neck.',
    category: 'vase',
    imageUrl: img('Stoneware Vase'),
    price: price(55),
    retailer: 'Atelier Blanc',
    availability: 'InStock',
    url: 'https://atelierblanc.example/products/stoneware-vase',
  },
  {
    id: 'fallback-plant-fiddle-leaf-fig',
    title: 'Fiddle Leaf Fig',
    description:
      'Potted fiddle leaf fig, roughly 4 ft tall, in a woven basket planter.',
    category: 'plant',
    imageUrl: img('Fiddle Leaf Fig'),
    price: price(89),
    retailer: 'Loft Supply Co.',
    availability: 'Unknown',
    url: 'https://loftsupply.example/products/fiddle-leaf-fig',
  },
]

function toProduct(entry: CatalogEntry): Product {
  return {
    id: entry.id,
    title: entry.title,
    imageUrl: entry.imageUrl,
    price: entry.price,
    retailer: entry.retailer,
    availability: entry.availability,
    url: entry.url,
  }
}

function matchesFilters(entry: CatalogEntry, filters?: SearchFilters) {
  if (filters?.category) {
    const wanted = filters.category.toLowerCase()
    const category = entry.category.toLowerCase()
    // Bidirectional includes so "lamp" matches "floor lamp" and "chair"
    // matches "armchair".
    if (!category.includes(wanted) && !wanted.includes(category)) return false
  }
  if (filters?.minPrice != null || filters?.maxPrice != null) {
    // Price bounds are hard constraints: unknown prices cannot be proven within
    // them, so products without a price are excluded.
    if (entry.price === null) return false
    if (filters.minPrice != null && entry.price.amount < filters.minPrice) return false
    if (filters.maxPrice != null && entry.price.amount > filters.maxPrice) return false
  }
  return true
}

function includesToken(haystack: string, token: string) {
  return (
    haystack.includes(token) ||
    (token.endsWith('s') && haystack.includes(token.slice(0, -1)))
  )
}

// Simple offline search: token `.includes()` over title/description/category,
// ranked by how many query tokens match. Never returns an empty list for a
// non-empty catalog — if nothing matches, the filtered catalog is returned so
// the agent and UI always have products to work with.
export function searchLocalCatalog(query: string, filters?: SearchFilters): Product[] {
  const candidates = catalog.filter((entry) => matchesFilters(entry, filters))
  const tokens = query.toLowerCase().match(/[a-z0-9]+/g) ?? []

  let picked: CatalogEntry[]
  if (tokens.length === 0) {
    picked = candidates
  } else {
    const scored = candidates.map((entry) => {
      const haystack = `${entry.title} ${entry.description} ${entry.category}`.toLowerCase()
      const score = tokens.reduce(
        (count, token) => count + (includesToken(haystack, token) ? 1 : 0),
        0
      )
      return { entry, score }
    })
    const matched = scored.filter((item) => item.score > 0)
    const ranked = (matched.length > 0 ? matched : scored).sort(
      (a, b) => b.score - a.score
    )
    picked = ranked.map((item) => item.entry)
  }

  // Expose category context so id-only tools (estimate_dimensions) can resolve it.
  rememberProducts(
    picked.map((entry) => ({
      id: entry.id,
      title: entry.title,
      category: entry.category,
    }))
  )
  return picked.map(toProduct)
}
