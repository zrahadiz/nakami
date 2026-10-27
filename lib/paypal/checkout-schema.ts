// Shared zod schema for checkout request bodies — used by both
// /api/checkout/orders and /api/checkout/merchants so the two routes accept
// exactly the same item shape. Pure module: no `server-only`.
import z from "zod";

export const checkoutItemSchema = z.object({
    productId: z.string().trim().min(1).max(256),
    slot: z.string().trim().min(1).max(128).nullable().default(null),
    title: z.string().trim().min(1).max(512),
    retailer: z.string().trim().min(1).max(256),
    price: z.number().positive(),
    currency: z.string().trim().length(3).default("USD"),
    quantity: z.number().int().min(1).max(99).default(1),
});

// PayPal hard cap: at most 10 purchase_units per multi-seller order.
export const checkoutRequestSchema = z.object({
    threadId: z.uuid().nullable().default(null),
    items: z.array(checkoutItemSchema).min(1).max(10),
});
