"use client";

import { useEffect, useState } from "react";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";

import { money, type Product } from "@/types/workspaces";
import type { CaptureResult, CheckoutItemInput } from "@/lib/paypal/types";

/**
 * Real PayPal buttons for the board footer (multi-seller checkout: one
 * purchase unit per product, each paid to that product's own PayPal sandbox
 * merchant account).
 *
 * Flow, matching the backend routes:
 *   1. GET  /api/checkout/config     — is PayPal configured? sandbox badge.
 *   2. POST /api/checkout/merchants  — resolve payee merchant ids BEFORE the
 *      script loads (official multi-merchant requirement) so the provider can
 *      be mounted with the merchant-id list.
 *   3. PayPalButtons createOrder     -> POST /api/checkout/orders (server
 *      snapshots the board, resolves payees again, creates the PayPal order).
 *   4. onApprove                     -> POST .../capture (idempotent; retries
 *      while PayPal is still processing a 504).
 */

type Config =
  | { state: "loading" }
  | { state: "unconfigured" }
  | { state: "ready"; env: string; clientId: string; merchantIds: string[] }
  | { state: "blocked"; message: string; productIds?: string[] };

type CheckoutPhase =
  | { kind: "idle" }
  | { kind: "working" } // order created or capture running
  | { kind: "done"; result: CaptureResult };

export function CheckoutPanel({
  products,
  threadId,
}: {
  products: Product[];
  threadId: string | null;
}) {
  const [config, setConfig] = useState<Config>({ state: "loading" });
  const [phase, setPhase] = useState<CheckoutPhase>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [internalOrderId, setInternalOrderId] = useState<string | null>(null);

  const items: CheckoutItemInput[] = products.map((product) => ({
    productId: product.id,
    title: product.name,
    retailer: product.retailer,
    price: product.price,
    currency: "USD",
    quantity: 1,
    slot: product.slot,
  }));
  // The serialized body must stay stable across button callbacks.
  const itemsJson = JSON.stringify(items);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const configRes = await fetch("/api/checkout/config");
        const config = await configRes.json();
        if (!configRes.ok || !config.configured) {
          if (!cancelled) setConfig({ state: "unconfigured" });
          return;
        }

        const merchantsRes = await fetch("/api/checkout/merchants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threadId, items }),
        });
        const merchants = await merchantsRes.json();
        if (!cancelled) {
          if (merchantsRes.ok) {
            setConfig({
              state: "ready",
              env: config.env,
              clientId: config.clientId,
              merchantIds: merchants.merchantIds,
            });
          } else {
            setConfig({
              state: "blocked",
              message: merchants.error ?? "Checkout is unavailable.",
              productIds: merchants.productIds,
            });
          }
        }
      } catch {
        if (!cancelled)
          setConfig({ state: "blocked", message: "Checkout is unavailable." });
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- items are serialized once per board render
  }, [itemsJson, threadId]);

  // Capture is idempotent on the server; `processing: true` (PayPal 504)
  // means "keep asking" rather than "failed".
  async function captureWithRetries(orderId: string): Promise<CaptureResult> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(`/api/checkout/orders/${orderId}/capture`, {
        method: "POST",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error ?? "Capture failed.");
      }
      const result = body as CaptureResult;
      if (!result.processing) return result;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error(
      "PayPal is still processing the payment — try again in a moment or check your order history.",
    );
  }

  if (config.state === "loading" || config.state === "unconfigured") {
    return (
      <p className="mt-4 text-xs text-muted-foreground">
        {config.state === "loading"
          ? "Loading checkout…"
          : "Checkout is unavailable — PayPal isn't configured on the server yet."}
      </p>
    );
  }

  if (config.state === "blocked") {
    return (
      <div className="mt-4 rounded-xl border border-[#B3261E]/30 bg-[#B3261E]/5 p-3 text-xs text-destructive">
        <p className="flex items-start gap-2">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          {config.message}
        </p>
        {config.productIds?.length ? (
          <p className="mt-1.5 pl-5.5 text-[11px] text-muted-foreground">
            Unmapped products: {config.productIds.join(", ")}
          </p>
        ) : null}
      </div>
    );
  }

  if (phase.kind === "done") {
    return <CheckoutResult result={phase.result} />;
  }

  return (
    <div className="mt-4">
      {config.env === "sandbox" && (
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          PayPal Sandbox — no real money is charged
        </p>
      )}

      <PayPalScriptProvider
        options={{
          clientId: config.clientId,
          currency: "USD",
          intent: "capture",
          // Official multi-merchant requirement: pass the seller
          // merchant ids (the lib sends them as data-merchant-id).
          merchantId: config.merchantIds,
        }}
      >
        <PayPalButtons
          style={{ layout: "vertical", shape: "pill", label: "paypal" }}
          disabled={phase.kind === "working"}
          createOrder={async () => {
            setError(null);
            setPhase({ kind: "working" });
            try {
              const res = await fetch("/api/checkout/orders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  threadId,
                  items: JSON.parse(itemsJson),
                }),
              });
              const body = await res.json().catch(() => null);
              if (!res.ok) {
                throw new Error(body?.error ?? "Could not start checkout.");
              }
              setInternalOrderId(body.internalOrderId);
              return body.paypalOrderId as string;
            } catch (err) {
              setPhase({ kind: "idle" });
              setError(
                err instanceof Error
                  ? err.message
                  : "Could not start checkout.",
              );
              throw err;
            }
          }}
          onApprove={async () => {
            if (!internalOrderId) {
              throw new Error("Missing order reference.");
            }
            try {
              const result = await captureWithRetries(internalOrderId);
              setPhase({ kind: "done", result });
            } catch (err) {
              setPhase({ kind: "idle" });
              setError(err instanceof Error ? err.message : "Capture failed.");
            }
          }}
          onCancel={() => {
            setPhase({ kind: "idle" });
            setError(null);
          }}
          onError={(err) => {
            setPhase({ kind: "idle" });
            setError(
              err instanceof Error && err.message
                ? err.message
                : "PayPal had a problem — please try again.",
            );
          }}
        />
      </PayPalScriptProvider>
      {phase.kind === "working" && (
        <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Creating your order…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function CheckoutResult({ result }: { result: CaptureResult }) {
  const completed = result.items.filter(
    (item) => item.captureStatus === "COMPLETED",
  );
  const declined = result.items.filter(
    (item) => item.captureStatus === "DECLINED",
  );
  // netAmount is post-fee, so don't present it as the buyer's total.
  const paid = completed.reduce((sum, item) => sum + (item.netAmount ?? 0), 0);

  if (result.status === "completed") {
    return (
      <div className="mt-4 rounded-xl border border-[#5C6B52]/30 bg-[#5C6B52]/10 p-3">
        <p className="flex items-center gap-2 text-sm font-medium text-[#3F4B38]">
          <CheckCircle2 className="size-4" />
          Order paid — {completed.length}{" "}
          {completed.length === 1 ? "item" : "items"} captured ({money(paid)}{" "}
          after fees).
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {completed.length} {completed.length === 1 ? "merchant" : "merchants"}{" "}
          received their funds (sandbox).
        </p>
      </div>
    );
  }

  if (result.status === "partially_completed") {
    return (
      <div className="mt-4 rounded-xl border border-[#B3261E]/30 bg-[#B3261E]/5 p-3">
        <p className="flex items-center gap-2 text-sm font-medium text-destructive">
          <TriangleAlert className="size-4" />
          Partial payment — {completed.length} of {result.items.length} items
          captured.
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Declined:{" "}
          {declined.map((item) => item.purchaseRef).join(", ") ||
            "see order details"}
          . Re-open the summary to pay the remaining items.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-[#B3261E]/30 bg-[#B3261E]/5 p-3">
      <p className="flex items-center gap-2 text-sm font-medium text-destructive">
        <TriangleAlert className="size-4" />
        Payment failed — nothing was captured.
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Try the payment again (PayPal may ask you to pick another funding
        source).
      </p>
    </div>
  );
}
