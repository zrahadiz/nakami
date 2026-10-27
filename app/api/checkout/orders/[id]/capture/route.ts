import { createClient } from "@/lib/supabase/server";
import { captureMultiSellerOrder } from "@/lib/paypal/capture-multi-seller-order";
import {
    CheckoutNotFoundError,
    CheckoutValidationError,
    PayPalApiError,
    PayPalNotConfiguredError,
} from "@/lib/paypal/errors";
import z from "zod";

// POST /api/checkout/orders/[id]/capture — capture the buyer-approved order.
// 200 even when the capture itself failed: the body's normalized status
// (failed / partially_completed) plus per-item capture states tell the board
// UI what to show and retry.
export async function POST(
    _request: Request,
    ctx: RouteContext<"/api/checkout/orders/[id]/capture">,
) {
    const supabase = await createClient();

    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Next 16: params is a Promise — await before reading the id.
    const { id } = await ctx.params;
    const parsed = z.uuid().safeParse(id);
    if (!parsed.success) {
        return Response.json({ error: "Invalid order id" }, { status: 400 });
    }

    try {
        const result = await captureMultiSellerOrder(user.id, parsed.data);
        return Response.json(result);
    } catch (err) {
        if (err instanceof CheckoutNotFoundError) {
            return Response.json({ error: err.message }, { status: 404 });
        }
        if (err instanceof CheckoutValidationError) {
            return Response.json({ error: err.message }, { status: 400 });
        }
        if (err instanceof PayPalNotConfiguredError) {
            return Response.json({ error: err.message }, { status: 503 });
        }
        if (err instanceof PayPalApiError) {
            console.error("PayPal capture failed", err.status, err.body);
            return Response.json(
                { error: "PayPal capture failed", issue: err.issue },
                { status: 502 },
            );
        }
        console.error(err);
        return Response.json({ error: "Failed to capture order" }, { status: 500 });
    }
}
