"use client";

// lib/workspace/use-purchased.ts
//
// Which products has the user already paid for? Derived from saved orders
// (GET /api/checkout/orders), so it survives refreshes and works across threads.

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { getOrders } from "@/lib/api/orders";

export const ordersQueryKey = ["orders"] as const;

type Loose = Record<string, unknown>;

const isObj = (v: unknown): v is Loose =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const str = (v: unknown) => (typeof v === "string" && v ? v : null);

/**
 * Product ids with a completed payment.
 * ⚠️ Adjust the field names below if your `Transaction` type differs.
 */
export function purchasedIdsFrom(transactions: unknown[]): Set<string> {
  const ids = new Set<string>();

  for (const transaction of transactions) {
    if (!isObj(transaction) || !Array.isArray(transaction.items)) continue;

    for (const item of transaction.items) {
      if (!isObj(item)) continue;

      const status = String(item.captureStatus ?? item.status ?? "").toLowerCase();
      const paid = status === "completed" || status === "paid";
      const id = str(item.productId) ?? str(item.product_id);

      if (paid && id) ids.add(id);
    }
  }

  return ids;
}

export function usePurchasedProducts() {
  const query = useQuery({
    queryKey: ordersQueryKey,
    queryFn: getOrders,
    staleTime: 30_000,
  });

  const purchasedIds = useMemo(
    () => purchasedIdsFrom(query.data ?? []),
    [query.data],
  );

  return { purchasedIds, isLoading: query.isLoading };
}