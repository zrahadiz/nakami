import { isPayPalConfigured } from "@/lib/paypal/client";
import {
    applyWebhookEvent,
    verifyWebhookSignature,
    type PayPalWebhookEvent,
} from "@/lib/paypal/webhooks";

// POST /api/webhooks/paypal — PayPal event ingestion. Authenticated by
// signature verification (no Supabase session exists on PayPal's call).
// Unverifiable deliveries get 401 so PayPal retries them; verified events are
// applied idempotently and always acknowledged.
export async function POST(request: Request) {
    if (!isPayPalConfigured()) {
        return Response.json({ error: "PayPal is not configured" }, { status: 503 });
    }

    // The raw bytes PayPal signed — no re-serialization before verification.
    const rawBody = await request.text();

    let verified = false;
    try {
        verified = await verifyWebhookSignature(request.headers, rawBody);
    } catch (err) {
        console.error("PayPal webhook signature check failed", err);
        return Response.json({ error: "Signature verification failed" }, { status: 401 });
    }
    if (!verified) {
        return Response.json({ error: "Invalid webhook signature" }, { status: 401 });
    }

    try {
        const event = JSON.parse(rawBody) as PayPalWebhookEvent;
        await applyWebhookEvent(event);
    } catch (err) {
        console.error("Failed to apply PayPal webhook event", err);
        return Response.json({ error: "Failed to process event" }, { status: 500 });
    }
    return Response.json({ received: true });
}
