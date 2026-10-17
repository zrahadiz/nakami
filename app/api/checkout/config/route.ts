import { getPayPalConfig, isPayPalConfigured } from "@/lib/paypal/client";

// GET /api/checkout/config — bootstrap info for the PayPal JS SDK buttons.
// The client id is publishable by design; secrets stay server-side.
export async function GET() {
    if (!isPayPalConfigured()) {
        return Response.json({
            configured: false,
            env: null,
            clientId: null,
            currency: "USD",
        });
    }
    const config = getPayPalConfig();
    return Response.json({
        configured: true,
        env: config.env,
        clientId: config.clientId,
        currency: "USD",
    });
}
