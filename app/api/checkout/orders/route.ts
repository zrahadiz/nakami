import { createClient } from "@/lib/supabase/server";
import { createMultiSellerOrder } from "@/lib/paypal/create-multi-seller-order";
import { normalizeCaptureStatus } from "@/lib/paypal/order-interpretation";
import type { OrderStatus, Transaction, TransactionItem } from "@/lib/paypal/types";
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

// GET /api/checkout/orders — every transaction for the authenticated user,
// newest first, with the per-product capture state from order_items.
export async function GET() {
    const supabase = await createClient();

    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: orderRows, error: ordersError } = await supabase
        .from("orders")
        .select(
            "id, thread_id, status, currency, total_amount, paypal_order_id, paypal_payer_email, error, created_at, updated_at",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
    if (ordersError) {
        console.error(ordersError);
        return Response.json(
            { error: "Failed to load transactions" },
            { status: 500 },
        );
    }

    const orders = orderRows ?? [];
    const itemsByOrder = new Map<string, TransactionItem[]>();
    const orderIds = orders.map((order) => order.id);

    if (orderIds.length > 0) {
        const { data: itemRows, error: itemsError } = await supabase
            .from("order_items")
            .select(
                "id, order_id, product_id, title, retailer, slot, unit_price, quantity, purchase_ref, paypal_capture_id, capture_status, net_amount",
            )
            .eq("user_id", user.id)
            .in("order_id", orderIds)
            .order("created_at", { ascending: true });
        if (itemsError) {
            console.error(itemsError);
            return Response.json(
                { error: "Failed to load transactions" },
                { status: 500 },
            );
        }

        for (const row of itemRows ?? []) {
            const items = itemsByOrder.get(row.order_id) ?? [];
            items.push({
                id: row.id,
                productId: row.product_id,
                title: row.title,
                retailer: row.retailer,
                slot: row.slot,
                unitPrice: row.unit_price,
                quantity: row.quantity,
                purchaseRef: row.purchase_ref,
                captureId: row.paypal_capture_id,
                captureStatus: normalizeCaptureStatus(
                    row.capture_status ?? undefined,
                ),
                netAmount: row.net_amount,
            });
            itemsByOrder.set(row.order_id, items);
        }
    }

    const transactions: Transaction[] = orders.map((order) => ({
        id: order.id,
        threadId: order.thread_id,
        status: order.status as OrderStatus,
        currency: order.currency,
        totalAmount: order.total_amount,
        paypalOrderId: order.paypal_order_id,
        payerEmail: order.paypal_payer_email,
        error: order.error,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        items: itemsByOrder.get(order.id) ?? [],
    }));

    return Response.json(transactions);
}

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
