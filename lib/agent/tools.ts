import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'
import { searchProducts } from '@/lib/channel3'
import { estimateDimensionsForProducts } from '@/lib/agent/dimensions'

// Server-side TanStack AI tools for the Nakami agent (BE-4).
// The input schemas below are the contract carried by the SSE
// tool-call events; outputs stay in the shared Product / DimensionEstimate
// shapes from lib/types.ts.

export const searchChannel3Tool = toolDefinition({
  name: 'search_channel3',
  description:
    'Search for interior products by keyword. Returns a list of products with prices and images.',
  inputSchema: z.object({
    query: z.string(),
    filters: z
      .object({
        minPrice: z.number().optional(),
        maxPrice: z.number().optional(),
        category: z.string().optional(),
      })
      .optional(),
  }),
}).server(async ({ query, filters }) => {
  const products = await searchProducts(query, filters)
  return { products }
})

export const estimateDimensionsTool = toolDefinition({
  name: 'estimate_dimensions',
  description: 'Estimate physical dimensions for a set of products.',
  inputSchema: z.object({
    productIds: z.array(z.string()),
  }),
}).server(({ productIds }) => {
  return { estimates: estimateDimensionsForProducts(productIds) }
})

// Convenience collection for chat() wiring in BE-5.
export const agentTools = [searchChannel3Tool, estimateDimensionsTool]
