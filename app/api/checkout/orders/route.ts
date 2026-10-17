import { createClient } from "@/lib/supabase/server";
import { createMultiSellerOrder } from "@/lib/paypal/create-multi-seller-order";
import {
    CheckoutValidationError,
    PayPalApiError,
    PayPalNotConfiguredError,
    UnresolvedMerchantError,
} from "@/lib/paypal/errors";
import { checkoutRequestSchema } from "@/lib/paypal/checkout-schema";

// One item per board product. The server re-resolves payees from
// paypal_merchants and snapshots the board, so the client can never forge an
// amount or redirect funds to a different merchant after the fact.
const createOrderSchema = checkoutRequestSchema;

// POST /api/checkout/orders — create the PayPal multi-seller order for the
// board. Returns the PayPal order id (for the JS SDK buttons) plus the
// merchant ids the SDK's merchant-id param needs.
export async function POST(request: Request) {
    const supabase = await createClient();

    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const result = createOrderSchema.safeParse(body);
    if (!result.success) {
        console.error(result.error);
        return Response.json({ error: result.error.message }, { status: 400 });
    }

    try {
        const created = await createMultiSellerOrder({
            userId: user.id,
            threadId: result.data.threadId,
            items: result.data.items,
        });
        return Response.json(created, { status: 201 });
    } catch (err) {
        if (err instanceof CheckoutValidationError) {
            return Response.json({ error: err.message }, { status: 400 });
        }
        if (err instanceof PayPalNotConfiguredError) {
            return Response.json({ error: err.message }, { status: 503 });
        }
        if (err instanceof UnresolvedMerchantError) {
            return Response.json(
                { error: err.message, productIds: err.productIds },
                { status: 503 },
            );
        }
        if (err instanceof PayPalApiError) {
            // The full PayPal body stays in server logs; only a summary ships.
            console.error("PayPal order creation failed", err.status, err.body);
            return Response.json(
                { error: "PayPal rejected the order", issue: err.issue },
                { status: 502 },
            );
        }
        console.error(err);
        return Response.json({ error: "Failed to create order" }, { status: 500 });
    }
}
