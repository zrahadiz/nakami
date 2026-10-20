"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  ReceiptText,
  RotateCw,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getOrders } from "@/lib/api/orders";
import type { Transaction, TransactionItem } from "@/lib/paypal/types";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const dateTime = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

const statusMeta: Record<
  Transaction["status"],
  { label: string; className: string }
> = {
  created: {
    label: "Created",
    className: "border-border bg-muted text-muted-foreground",
  },
  approved: {
    label: "Approved",
    className:
      "border-[#2F5D8C]/25 bg-[#2F5D8C]/10 text-[#2F5D8C] dark:text-[#9BB8D9]",
  },
  completed: {
    label: "Paid",
    className:
      "border-[#5C6B52]/25 bg-[#5C6B52]/10 text-[#3F4B38] dark:text-[#B9C8AD]",
  },
  partially_completed: {
    label: "Partially paid",
    className:
      "border-[#B7791F]/25 bg-[#B7791F]/10 text-[#8A5A12] dark:text-[#E7C27D]",
  },
  failed: {
    label: "Failed",
    className: "border-destructive/25 bg-destructive/10 text-destructive",
  },
  canceled: {
    label: "Canceled",
    className: "border-border bg-muted text-muted-foreground",
  },
};

const captureMeta: Record<
  NonNullable<TransactionItem["captureStatus"]>,
  { label: string; className: string }
> = {
  COMPLETED: {
    label: "Captured",
    className:
      "border-[#5C6B52]/25 bg-[#5C6B52]/10 text-[#3F4B38] dark:text-[#B9C8AD]",
  },
  PARTIALLY_COMPLETED: {
    label: "Partial",
    className:
      "border-[#B7791F]/25 bg-[#B7791F]/10 text-[#8A5A12] dark:text-[#E7C27D]",
  },
  PENDING: {
    label: "Pending",
    className:
      "border-[#2F5D8C]/25 bg-[#2F5D8C]/10 text-[#2F5D8C] dark:text-[#9BB8D9]",
  },
  DECLINED: {
    label: "Declined",
    className: "border-destructive/25 bg-destructive/10 text-destructive",
  },
  VOIDED: {
    label: "Voided",
    className: "border-border bg-muted text-muted-foreground",
  },
};

function CaptureBadge({ status }: { status: TransactionItem["captureStatus"] }) {
  const meta = status ? captureMeta[status] : null;

  return (
    <Badge
      variant="outline"
      className={meta?.className ?? "border-border bg-muted text-muted-foreground"}
    >
      {meta?.label ?? "Awaiting capture"}
    </Badge>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadOrders() {
      try {
        const data = await getOrders();

        if (!cancelled) {
          setOrders(data);
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load your orders.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadOrders();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  function retry() {
    setError(null);
    setLoading(true);
    setReloadKey((key) => key + 1);
  }

  return (
    <div className="min-h-full px-5 py-12 lg:px-10 lg:py-16">
      <div className="mx-auto w-full max-w-4xl">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Account
        </p>

        <h1 className="mt-2 font-(family-name:--font-display) text-4xl font-medium tracking-tight sm:text-5xl">
          Orders
        </h1>

        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Every checkout you&apos;ve made, with the PayPal capture state for
          each product.
        </p>

        {error && (
          <div
            role="alert"
            className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            <span>{error}</span>

            <button
              type="button"
              onClick={retry}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-medium outline-none transition hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-destructive/40"
            >
              <RotateCw className="size-3.5" />
              Try again
            </button>
          </div>
        )}

        <div className="mt-8 space-y-5">
          {loading &&
            [0, 1, 2].map((index) => (
              <Card key={index} className="gap-0 py-0">
                <CardHeader className="border-b border-border/70 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-6 w-40" />
                      <Skeleton className="h-3 w-52" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="ml-auto h-5 w-20" />
                      <Skeleton className="ml-auto h-6 w-24" />
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 p-5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}

          {!loading &&
            orders.map((order) => {
              const status = statusMeta[order.status];

              return (
                <Card key={order.id} className="gap-0 py-0">
                  <CardHeader className="border-b border-border/70 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                          {dateTime.format(new Date(order.createdAt))}
                        </p>

                        <CardTitle className="mt-1 font-(family-name:--font-display) text-xl font-medium tracking-tight">
                          Order {order.id.slice(0, 8)}
                        </CardTitle>

                        <p className="mt-1 text-xs text-muted-foreground">
                          {order.items.length}{" "}
                          {order.items.length === 1 ? "item" : "items"}
                          {order.paypalOrderId
                            ? ` · PayPal ${order.paypalOrderId}`
                            : ""}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                        <Badge variant="outline" className={status.className}>
                          {status.label}
                        </Badge>

                        <p className="font-(family-name:--font-mono) text-lg leading-none">
                          {money.format(order.totalAmount)}
                        </p>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-5">
                    <ul className="divide-y divide-border/70">
                      {order.items.map((item) => (
                        <li
                          key={item.id}
                          className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{item.title}</p>

                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {item.retailer}
                              {item.slot ? ` · ${item.slot}` : ""} · Qty{" "}
                              {item.quantity}
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="font-(family-name:--font-mono) text-sm">
                              {money.format(item.unitPrice)}
                            </span>

                            <CaptureBadge status={item.captureStatus} />
                          </div>
                        </li>
                      ))}
                    </ul>

                    {order.error && (
                      <p className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                        {order.error}
                      </p>
                    )}

                    {order.threadId && (
                      <Link
                        href={`/workspace/${order.threadId}`}
                        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#B84A25] outline-none transition hover:underline focus-visible:ring-2 focus-visible:ring-[#D9623B]/30 dark:text-[#F0A185]"
                      >
                        View board
                        <ArrowRight className="size-3.5" />
                      </Link>
                    )}
                  </CardContent>
                </Card>
              );
            })}
        </div>

        {!loading && !error && orders.length === 0 && (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
            <ReceiptText className="mx-auto size-8 text-muted-foreground/60" />

            <h2 className="mt-4 font-(family-name:--font-display) text-2xl font-medium">
              No orders yet
            </h2>

            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              When you complete a checkout, your orders and their PayPal capture
              status will show up here.
            </p>

            <Link
              href="/dashboard"
              className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#D9623B] px-4 text-sm font-medium text-white shadow-[0_8px_20px_-10px_rgba(217,98,59,0.9)] outline-none transition hover:bg-[#C4532D] focus-visible:ring-4 focus-visible:ring-[#D9623B]/30"
            >
              Start a board
              <ArrowRight className="size-4" />
            </Link>
          </div>
        )}

        {loading && (
          <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Loading orders…
          </p>
        )}
      </div>
    </div>
  );
}
