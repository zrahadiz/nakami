import { z } from 'zod'

// Single source of truth for the agent's structured output shape (BE-5).
// The SSE contract carries this object on `structured-output.complete`, and the
// assistant message persists it as a `structured-output` part.
export const AgentPlanSchema = z.object({
  summary: z.string().describe('1-2 sentence description of the plan'),
  searchQuery: z.string().describe('the product search query the plan is based on'),
  productIds: z.array(z.string()).describe('IDs of the products in the plan'),
  dimensions: z
    .object({
      length: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      unit: z.enum(['cm', 'in']),
    })
    .optional()
    .describe('overall bounding box for the planned arrangement'),
  followUp: z.string().optional().describe('optional suggested next step'),
})

export type AgentPlan = z.infer<typeof AgentPlanSchema>
