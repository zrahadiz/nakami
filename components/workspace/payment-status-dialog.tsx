"use client";

// components/workspace/payment-status-dialog.tsx

import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  RotateCw,
  TriangleAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { money } from "@/types/workspaces";

export type PaymentDialogStatus =
  | "capturing"
  | "completed"
  | "partial"
  | "failed";

type Props = {
  open: boolean;
  status: PaymentDialogStatus;
  /** What the buyer paid in total (for the success message). */
  total: number;
  paidCount: number;
  itemCount: number;
  /** References of items that were declined (partial payments). */
  declined: string[];
  sandbox: boolean;
  /** Close the dialog and stay in the workspace. */
  onStay: () => void;
  onViewOrders: () => void;
  /** Try again (partial or failed payments). */
  onRetry: () => void;
};

const tones = {
  success: "bg-[#5C6B52]/15 text-[#3F4B38]",
  error: "bg-[#B3261E]/10 text-[#B3261E]",
  working: "bg-muted text-foreground",
};

/** Round icon that eases in when the dialog content appears. */
function StatusMark({
  tone,
  children,
}: {
  tone: keyof typeof tones;
  children: ReactNode;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <span
      className={`grid size-16 place-items-center rounded-full transition duration-500 ${tones[tone]} ${
        shown ? "scale-100 opacity-100" : "scale-75 opacity-0"
      }`}
    >
      {children}
    </span>
  );
}

const primaryButton =
  "h-11 rounded-xl bg-[#D9623B] px-5 text-white shadow-[0_8px_20px_-10px_rgba(217,98,59,0.9)] hover:bg-[#C4532D]";
const secondaryButton = "h-11 rounded-xl px-5";

export function PaymentStatusDialog({
  open,
  status,
  total,
  paidCount,
  itemCount,
  declined,
  sandbox,
  onStay,
  onViewOrders,
  onRetry,
}: Props) {
  const noun = (n: number) => (n === 1 ? "item" : "items");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Never allow dismissing while the payment is being confirmed.
        if (!next && status !== "capturing") onStay();
      }}
    >
      <DialogContent className="rounded-3xl p-8 sm:max-w-md">
        <DialogHeader className="items-center gap-4 text-center sm:text-center">
          {status === "capturing" && (
            <>
              <StatusMark tone="working">
                <Loader2 className="size-7 animate-spin" />
              </StatusMark>
              <div className="space-y-1.5">
                <DialogTitle className="font-(family-name:--font-display) text-2xl font-medium">
                  Confirming your payment
                </DialogTitle>
                <DialogDescription>
                  This only takes a moment. Please don&apos;t close this page.
                </DialogDescription>
              </div>
            </>
          )}

          {status === "completed" && (
            <>
              <StatusMark tone="success">
                <CheckCircle2 className="size-8" />
              </StatusMark>
              <div className="space-y-1.5">
                <DialogTitle className="font-(family-name:--font-display) text-2xl font-medium">
                  Payment complete
                </DialogTitle>
                <DialogDescription>
                  You paid{" "}
                  <span className="font-(family-name:--font-mono) text-foreground">
                    {money(total)}
                  </span>{" "}
                  for {paidCount} {noun(paidCount)}. Your receipt is saved in
                  your orders.
                  {sandbox
                    ? " This was a sandbox payment, so no real money moved."
                    : ""}
                </DialogDescription>
              </div>
            </>
          )}

          {status === "partial" && (
            <>
              <StatusMark tone="error">
                <TriangleAlert className="size-8" />
              </StatusMark>
              <div className="space-y-1.5">
                <DialogTitle className="font-(family-name:--font-display) text-2xl font-medium">
                  Only part of your order was paid
                </DialogTitle>
                <DialogDescription>
                  {paidCount} of {itemCount} {noun(itemCount)} went through.
                  {declined.length > 0
                    ? ` Not paid: ${declined.join(", ")}.`
                    : ""}{" "}
                  You can try the rest again.
                </DialogDescription>
              </div>
            </>
          )}

          {status === "failed" && (
            <>
              <StatusMark tone="error">
                <TriangleAlert className="size-8" />
              </StatusMark>
              <div className="space-y-1.5">
                <DialogTitle className="font-(family-name:--font-display) text-2xl font-medium">
                  Payment failed
                </DialogTitle>
                <DialogDescription>
                  Nothing was charged. PayPal may ask you to choose another
                  payment method.
                </DialogDescription>
              </div>
            </>
          )}
        </DialogHeader>

        {status === "completed" && (
          <DialogFooter className="mt-2 gap-2 sm:justify-center">
            <Button
              variant="outline"
              onClick={onStay}
              className={secondaryButton}
            >
              Stay in workspace
            </Button>
            <Button onClick={onViewOrders} className={primaryButton}>
              Go to orders
              <ArrowRight className="size-4" />
            </Button>
          </DialogFooter>
        )}

        {status === "partial" && (
          <DialogFooter className="mt-2 gap-2 sm:justify-center">
            <Button
              variant="outline"
              onClick={onStay}
              className={secondaryButton}
            >
              Stay in workspace
            </Button>
            <Button onClick={onRetry} className={primaryButton}>
              <RotateCw className="size-4" />
              Pay the rest
            </Button>
          </DialogFooter>
        )}

        {status === "failed" && (
          <DialogFooter className="mt-2 gap-2 sm:justify-center">
            <Button
              variant="outline"
              onClick={onStay}
              className={secondaryButton}
            >
              Close
            </Button>
            <Button onClick={onRetry} className={primaryButton}>
              <RotateCw className="size-4" />
              Try again
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
