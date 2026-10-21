import { createClient } from "@/lib/supabase/server";
import { prepareCheckoutItems } from "@/lib/paypal/purchase-units";
import { resolvePayees } from "@/lib/paypal/merchants";
import { isPayPalConfigured } from "@/lib/paypal/client";
import {
    CheckoutValidationError,
    PayPalNotConfiguredError,
    UnresolvedMerchantError,
} from "@/lib/paypal/errors";
import { checkoutRequestSchema } from "@/lib/paypal/checkout-schema";

// POST /api/checkout/merchants — resolve the seller merchant ids for a set of
// items WITHOUT creating a PayPal order. The JS SDK needs the merchant list at
// script-load time (official multi-merchant requirement: merchant-id /
// data-merchant-id), before the buyer clicks a button.
//
// The list must be EXACTLY this cart's payees, not the whole assignable pool:
// the SDK validates the created order against merchant-id by set equality
// (same length and same members), so an extra declared seller fails a
// single-seller order. The checkout panel therefore remounts the provider with
// a fresh namespace whenever this list changes.
export async function POST(request: Request) {
    const supabase = await createClient();

    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isPayPalConfigured()) {
        return Response.json(
            { error: new PayPalNotConfiguredError().message },
            { status: 503 },
        );
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const result = checkoutRequestSchema.safeParse(body);
    if (!result.success) {
        console.error(result.error);
        return Response.json({ error: result.error.message }, { status: 400 });
    }

    try {
        // Same validation path as order creation, so a cart that resolves
        // here will also pass when the buyer clicks the button.
        const items = prepareCheckoutItems(result.data.items);
        const payees = await resolvePayees(items);
        // Sorted so the provider key/namespace is stable when only the cart
        // order changes; the SDK compares the list as a set, not by position.
        const merchantIds = [
            ...new Set([...payees.values()].map((payee) => payee.merchantId)),
        ].sort();
        return Response.json({ merchantIds });
    } catch (err) {
        if (err instanceof CheckoutValidationError) {
            return Response.json({ error: err.message }, { status: 400 });
        }
        if (err instanceof UnresolvedMerchantError) {
            return Response.json(
                { error: err.message, productIds: err.productIds },
                { status: 503 },
            );
        }
        console.error(err);
        return Response.json(
            { error: "Failed to resolve merchants" },
            { status: 500 },
        );
    }
}
