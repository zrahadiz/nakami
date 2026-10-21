"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  PayPalButtons,
  PayPalScriptProvider,
  usePayPalScriptReducer,
} from "@paypal/react-paypal-js";
import { Info, Loader2, Lock, RotateCw, TriangleAlert, X } from "lucide-react";

import {
  CheckoutApiError,
  captureOrderWithRetries,
  createCheckoutOrder,
  getCheckoutConfig,
  getCheckoutErrorMessage,
  getCheckoutMerchants,
} from "@/lib/api/checkout";
import type { CaptureResult, CheckoutItemInput } from "@/lib/paypal/types";
import { money, type Product } from "@/types/workspaces";
import {
  PaymentStatusDialog,
  type PaymentDialogStatus,
} from "./payment-status-dialog";

type Config =
  | { state: "loading" }
  | { state: "unconfigured" }
  | { state: "ready"; env: string; clientId: string; merchantIds: string[] }
  | { state: "blocked"; message: string; productIds?: string[] };

type Phase =
  | { kind: "idle" }
  | { kind: "creating" } // creating the order on our server
  | { kind: "awaiting" } // the PayPal window is open
  | { kind: "capturing" } // taking the payment (shown in the dialog)
  | { kind: "done"; result: CaptureResult; total: number }; // shown in the dialog

type Tone = "info" | "error";

const toneClasses: Record<Tone, string> = {
  info: "border-border bg-muted/50 text-foreground",
  error: "border-[#B3261E]/30 bg-[#B3261E]/5 text-destructive",
};

/* ---------- small pieces ---------- */

function Notice({
  tone,
  icon,
  title,
  children,
  action,
  onDismiss,
}: {
  tone: Tone;
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-2xl border p-4 ${toneClasses[tone]}`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{title}</p>
          {children ? (
            <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {children}
            </div>
          ) : null}
          {action ? <div className="mt-3">{action}</div> : null}
        </div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="grid size-6 shrink-0 place-items-center rounded-full text-current opacity-60 outline-none transition hover:opacity-100 focus-visible:ring-2 focus-visible:ring-current"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SmallButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-background px-3.5 text-xs font-medium text-foreground outline-none transition hover:bg-accent focus-visible:ring-2 focus-visible:ring-[#D9623B]/40"
    >
      {children}
    </button>
  );
}

function Header({ sandbox }: { sandbox: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Lock className="size-4 text-[#5C6B52]" />
        Secure checkout with PayPal
      </p>
      {sandbox ? (
        <span className="rounded-full bg-[#D9623B]/12 px-2.5 py-1 text-[11px] font-medium text-[#B84A25]">
          Sandbox: no real money
        </span>
      ) : null}
    </div>
  );
}

function ButtonsSkeleton() {
  return (
    <div className="space-y-2.5" aria-hidden>
      <div className="h-11 animate-pulse rounded-full bg-muted" />
      <div className="h-11 animate-pulse rounded-full bg-muted" />
    </div>
  );
}

/** Shows a skeleton while the PayPal SDK loads, or an error if it fails to load. */
function PayPalGate({ children }: { children: ReactNode }) {
  const [{ isPending, isRejected }] = usePayPalScriptReducer();

  if (isRejected) {
    return (
      <Notice
        tone="error"
        icon={<TriangleAlert className="size-4" />}
        title="PayPal couldn't load"
      >
        Check your connection or ad blocker, then reload the page.
      </Notice>
    );
  }

  return (
    <>
      {isPending ? <ButtonsSkeleton /> : null}
      {children}
    </>
  );
}

/* ---------- panel ---------- */

export function CheckoutPanel({
  products,
  threadId,
  onClose,
  onPaid,
  onPaidDone,
  onReset,
  ordersHref = "/orders", // ⚠️ your orders / transaction history page
}: {
  products: Product[];
  threadId: string | null;
  /** Called whenever the payment dialog is dismissed. */
  onClose?: () => void;
  /** Called when a payment attempt finishes, so the parent can refresh purchased state. */
  onPaid?: () => void;
  /** Called when the dialog is dismissed after a fully successful payment ("Stay in workspace"). */
  onPaidDone?: () => void;
  /** Called when the user retries after a partial or failed payment. */
  onReset?: () => void;
  ordersHref?: string;
}) {
  const router = useRouter();

  const [config, setConfig] = useState<Config>({ state: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  // A ref, not state: PayPal's button callbacks can hold stale closures.
  const internalOrderIdRef = useRef<string | null>(null);

  const items = useMemo<CheckoutItemInput[]>(
    () =>
      products.map((product) => ({
        productId: product.id,
        title: product.name,
        retailer: product.retailer,
        price: product.price,
        currency: "USD",
        quantity: 1,
        slot: product.slot,
      })),
    [products],
  );
  // Serialized so effects and PayPal callbacks always see the same, stable value.
  const itemsKey = JSON.stringify(items);

  const total = products.reduce((sum, p) => sum + p.price, 0);
  const sellerCount = new Set(products.map((p) => p.retailer)).size;

  useEffect(() => {
    const current: CheckoutItemInput[] = JSON.parse(itemsKey);
    if (current.length === 0) return;

    const controller = new AbortController();
    let cancelled = false;

    setRefreshing(true);
    // Keep an already-ready config on screen while it refreshes (no SDK reload flicker).
    setConfig((prev) => (prev.state === "ready" ? prev : { state: "loading" }));

    (async () => {
      try {
        const cfg = await getCheckoutConfig(controller.signal);
        if (cancelled) return;

        if (!cfg.configured || !cfg.clientId) {
          setConfig({ state: "unconfigured" });
          return;
        }

        const merchantIds = await getCheckoutMerchants(
          { threadId, items: current },
          controller.signal,
        );
        if (cancelled) return;

        setConfig({
          state: "ready",
          env: cfg.env ?? "sandbox",
          clientId: cfg.clientId,
          merchantIds,
        });
      } catch (err) {
        if (cancelled) return;
        const apiError = err instanceof CheckoutApiError ? err : null;
        setConfig({
          state: "blocked",
          message: apiError?.message ?? "Checkout is unavailable.",
          productIds: apiError?.productIds,
        });
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [itemsKey, threadId, retryKey]);

  const nameOf = (id: string) => products.find((p) => p.id === id)?.name ?? id;

  /* ---- states without PayPal buttons ---- */

  if (products.length === 0) {
    return (
      <div className="mt-4">
        <Notice
          tone="info"
          icon={<Info className="size-4" />}
          title="Nothing to check out yet"
        >
          Add products to your board, or select the ones you want to buy.
        </Notice>
      </div>
    );
  }

  if (config.state === "loading") {
    return (
      <div
        className="mt-4 space-y-3"
        role="status"
        aria-label="Loading checkout"
      >
        <div className="h-5 w-48 animate-pulse rounded bg-muted" />
        <ButtonsSkeleton />
      </div>
    );
  }

  if (config.state === "unconfigured") {
    return (
      <div className="mt-4">
        <Notice
          tone="info"
          icon={<Info className="size-4" />}
          title="Checkout isn't available yet"
        >
          PayPal isn&apos;t set up on the server. Your board is saved, so you
          can come back and pay once it&apos;s ready.
        </Notice>
      </div>
    );
  }

  if (config.state === "blocked") {
    return (
      <div className="mt-4">
        <Notice
          tone="error"
          icon={<TriangleAlert className="size-4" />}
          title={config.message}
          action={
            <SmallButton
              onClick={() => {
                setConfig({ state: "loading" });
                setRetryKey((k) => k + 1);
              }}
            >
              <RotateCw className="size-3.5" />
              Try again
            </SmallButton>
          }
        >
          {config.productIds?.length ? (
            <>
              These items can&apos;t be bought through Nakami yet. Remove them
              from your selection to continue:
              <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
                {config.productIds.map((id) => (
                  <li key={id}>{nameOf(id)}</li>
                ))}
              </ul>
            </>
          ) : null}
        </Notice>
      </div>
    );
  }

  /* ---- ready: pay ---- */

  const busy = phase.kind !== "idle" || refreshing;

  const status =
    phase.kind === "creating"
      ? "Creating your order…"
      : phase.kind === "awaiting"
        ? "Complete your payment in the PayPal window…"
        : refreshing && phase.kind === "idle"
          ? "Updating your order…"
          : null;

  // Payment dialog: open while confirming and once the result is in.
  const result = phase.kind === "done" ? phase.result : null;
  const completedItems =
    result?.items.filter((i) => i.captureStatus === "COMPLETED") ?? [];
  const declinedItems =
    result?.items.filter((i) => i.captureStatus === "DECLINED") ?? [];

  const dialogStatus: PaymentDialogStatus =
    phase.kind === "capturing"
      ? "capturing"
      : result?.status === "completed"
        ? "completed"
        : result?.status === "partially_completed"
          ? "partial"
          : "failed";

  /** "Stay in workspace", or closing the dialog (✕ / Esc / outside click). */
  function dismissDialog() {
    const fullyPaid =
      phase.kind === "done" && phase.result.status === "completed";

    setPhase({ kind: "idle" });
    setError(null);
    onClose?.();
    // After a fully successful payment the parent clears the selection.
    if (fullyPaid) onPaidDone?.();
  }

  function retryPayment() {
    setPhase({ kind: "idle" });
    setError(null);
    onReset?.();
  }

  function goToOrders() {
    setPhase({ kind: "idle" });
    onClose?.();
    router.push(ordersHref);
  }

  return (
    <section className="mt-4 space-y-4">
      <Header sandbox={config.env === "sandbox"} />

      <div className="flex items-end justify-between gap-4 rounded-2xl bg-muted/50 px-4 py-3">
        <div>
          <p className="text-xs text-muted-foreground">You&apos;re paying</p>
          <p className="mt-0.5 font-(family-name:--font-mono) text-2xl leading-none">
            {money(total)}
          </p>
        </div>
        <p className="text-right text-xs text-muted-foreground">
          {products.length} {products.length === 1 ? "item" : "items"} ·{" "}
          {sellerCount} {sellerCount === 1 ? "seller" : "sellers"}
        </p>
      </div>

      <div
        className={`transition-opacity ${busy ? "pointer-events-none opacity-60" : ""}`}
        aria-busy={busy}
      >
        <PayPalScriptProvider
          options={{
            clientId: config.clientId,
            currency: "USD",
            intent: "capture",
            // Official multi-merchant requirement: pass the seller merchant
            // ids (the lib sends them as data-merchant-id).
            merchantId: config.merchantIds,
          }}
        >
          <PayPalGate>
            <PayPalButtons
              style={{ layout: "vertical", shape: "pill", label: "paypal" }}
              disabled={busy}
              createOrder={async () => {
                setError(null);
                setPhase({ kind: "creating" });
                try {
                  const order = await createCheckoutOrder({
                    threadId,
                    items: JSON.parse(itemsKey),
                  });
                  internalOrderIdRef.current = order.internalOrderId;
                  setPhase({ kind: "awaiting" });
                  return order.paypalOrderId;
                } catch (err) {
                  setPhase({ kind: "idle" });
                  setError(
                    getCheckoutErrorMessage(err, "Could not start checkout."),
                  );
                  throw err;
                }
              }}
              onApprove={async () => {
                const orderId = internalOrderIdRef.current;
                if (!orderId) {
                  setPhase({ kind: "idle" });
                  setError("Missing order reference. Please try again.");
                  return;
                }

                setPhase({ kind: "capturing" });
                try {
                  const captured = await captureOrderWithRetries(orderId);
                  setPhase({ kind: "done", result: captured, total });
                  onPaid?.();
                } catch (err) {
                  setPhase({ kind: "idle" });
                  setError(getCheckoutErrorMessage(err, "Capture failed."));
                }
              }}
              onCancel={() => {
                setPhase({ kind: "idle" });
                setError(null);
              }}
              onError={(err) => {
                setPhase({ kind: "idle" });
                // Keep a more specific message set by createOrder/capture, if any.
                setError(
                  (prev) =>
                    prev ??
                    (err instanceof Error && err.message
                      ? err.message
                      : "PayPal had a problem. Please try again."),
                );
              }}
            />
          </PayPalGate>
        </PayPalScriptProvider>
      </div>

      {status ? (
        <p
          role="status"
          className="flex items-center gap-2 text-xs text-muted-foreground"
        >
          <Loader2 className="size-3.5 animate-spin" />
          {status}
        </p>
      ) : null}

      {error ? (
        <Notice
          tone="error"
          icon={<TriangleAlert className="size-4" />}
          title="Payment didn't go through"
          onDismiss={() => setError(null)}
        >
          {error}
        </Notice>
      ) : null}

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        You pay once with PayPal. Each seller receives their part of the payment
        directly.
      </p>

      <PaymentStatusDialog
        open={phase.kind === "capturing" || phase.kind === "done"}
        status={dialogStatus}
        total={phase.kind === "done" ? phase.total : total}
        paidCount={completedItems.length}
        itemCount={result?.items.length ?? products.length}
        declined={declinedItems.map((i) => i.purchaseRef)}
        sandbox={config.env === "sandbox"}
        onStay={dismissDialog}
        onViewOrders={goToOrders}
        onRetry={retryPayment}
      />
    </section>
  );
}
