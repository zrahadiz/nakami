"use client";

// components/workspace/order-summary.tsx
//
// The order summary panel. Separates what is about to be paid from what was
// already purchased, and makes buying something again an explicit choice.

import { useState } from "react";
import { Check, Info } from "lucide-react";

import { money, type Product } from "@/types/workspaces";
import { CheckoutPanel } from "./checkout-panel";

export function OrderSummary({
  products,
  purchasedIds,
  threadId,
  onPaid,
  onPaymentDone,
  hasSelection,
}: {
  /** The selected products (or the whole board when nothing is selected). */
  products: Product[];
  /** Product ids the user has already paid for. */
  purchasedIds: Set<string>;
  threadId: string | null;
  /** Called after a payment attempt finishes: refresh the purchased state. */
  onPaid: () => void;
  /** After a fully successful payment, when the user chooses "Stay in workspace". */
  onPaymentDone?: () => void;
  /** True when the user has selected products (false = the summary covers the whole board). */
  hasSelection: boolean;
}) {
  // Product ids the user chose to buy again (this panel session only).
  const [rebuy, setRebuy] = useState<Set<string>>(new Set());
  // Freezes what the payment panel shows once a payment finishes, so the
  // result message doesn't vanish when the lists below update.
  const [frozen, setFrozen] = useState<Product[] | null>(null);

  const alreadyBought = products.filter((p) => purchasedIds.has(p.id));
  const toPay = products.filter(
    (p) => !purchasedIds.has(p.id) || rebuy.has(p.id),
  );

  const toggleRebuy = (id: string) =>
    setRebuy((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Group the payable items by retailer.
  const byRetailer = new Map<string, Product[]>();
  for (const p of toPay) {
    byRetailer.set(p.retailer, [...(byRetailer.get(p.retailer) ?? []), p]);
  }

  const payingProducts = frozen ?? toPay;

  // What to say when there is nothing to pay, so it matches the real situation.
  const emptyNotice =
    products.length === 0
      ? {
          title: "Your board is empty",
          body: "Add products to your board, then come back to check out.",
        }
      : hasSelection
        ? {
            title: "You’ve already bought everything you selected",
            body: "Want another copy? Choose “Buy again” on an item above.",
          }
        : {
            title: "Everything on your board is already purchased",
            body: "Want another copy? Choose “Buy again” on an item above.",
          };

  return (
    <div className="space-y-5">
      {/* TO PAY */}
      {toPay.length > 0 && !frozen ? (
        <section aria-label="Items to pay">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            To pay
          </p>

          <ul className="space-y-4">
            {[...byRetailer.entries()].map(([retailer, items]) => (
              <li key={retailer}>
                <div className="flex items-center justify-between gap-4 text-sm font-medium">
                  <span>{retailer}</span>
                  <span className="font-[family-name:var(--font-mono)]">
                    {money(items.reduce((sum, p) => sum + p.price, 0))}
                  </span>
                </div>

                <ul className="mt-1.5 space-y-1 border-l-2 border-border pl-3">
                  {items.map((p) => (
                    <li
                      key={p.slot}
                      className="flex items-start justify-between gap-4 text-sm text-muted-foreground"
                    >
                      <span className="min-w-0 truncate">
                        {p.name}
                        {purchasedIds.has(p.id) ? (
                          <span className="ml-2 rounded-full bg-[#D9623B]/12 px-2 py-0.5 text-[10px] font-medium text-[#B84A25]">
                            Buying again
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 font-[family-name:var(--font-mono)]">
                        {money(p.price)}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ALREADY PURCHASED */}
      {alreadyBought.length > 0 ? (
        <section aria-label="Already purchased">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Already purchased
          </p>

          <ul className="space-y-1.5">
            {alreadyBought.map((p) => {
              const again = rebuy.has(p.id);
              return (
                <li
                  key={p.slot}
                  className="flex items-center gap-3 rounded-xl bg-[#5C6B52]/8 px-3 py-2"
                >
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#5C6B52]/20 text-[#3F4B38]">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                    {p.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleRebuy(p.id)}
                    aria-pressed={again}
                    className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-[#D9623B]/40 ${
                      again
                        ? "bg-[#D9623B] text-white"
                        : "border border-border text-foreground/70 hover:bg-accent"
                    }`}
                  >
                    {again ? "Buying again ✓" : "Buy again"}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* PAYMENT */}
      {payingProducts.length > 0 ? (
        <CheckoutPanel
          products={payingProducts}
          threadId={threadId}
          onPaid={() => {
            setFrozen(toPay);
            onPaid();
          }}
          onPaidDone={onPaymentDone}
          onReset={() => {
            // Unfreeze: the payable list is recomputed without what was just paid.
            setFrozen(null);
            setRebuy(new Set());
          }}
          onClose={() => {
            setFrozen(null);
            setRebuy(new Set());
          }}
        />
      ) : (
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted/50 p-4">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">{emptyNotice.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {emptyNotice.body}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
