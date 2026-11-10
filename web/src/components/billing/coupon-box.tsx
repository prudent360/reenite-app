"use client";

import { useState, useTransition } from "react";
import { TicketPercent, X } from "lucide-react";
import { toast } from "sonner";
import { applyCoupon, removeCoupon } from "@/lib/actions/billing";
import type { FormState, Invoice } from "@/lib/types";
import { formatNaira } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DotLoader } from "@/components/ui/loader";

export type CouponActions = {
  apply: (code: string) => Promise<FormState>;
  remove: () => Promise<FormState>;
};

/**
 * "Have a discount code?" above the payment methods. The API works out the discount and the
 * page refreshes with the new amount. Bookings pass their own actions (guests use a token).
 */
export function CouponBox({ invoice, actions }: { invoice: Invoice; actions?: CouponActions }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const apply = actions?.apply ?? ((value: string) => applyCoupon(invoice.id, value));
  const remove = actions?.remove ?? (() => removeCoupon(invoice.id));

  if (invoice.coupon_code) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-sm">
        <TicketPercent className="size-5 shrink-0 text-success" />
        <p className="min-w-0 flex-1 text-foreground">
          <span className="font-mono font-semibold">{invoice.coupon_code}</span> applied: <span className="font-semibold">-{formatNaira(invoice.coupon_discount)}</span>
        </p>
        {invoice.accepts_coupon && (
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await remove();
                if (!result.ok) toast.error(result.message ?? "We couldn't remove the code.");
              })
            }
          >
            {pending ? <DotLoader className="text-current" label="Removing" /> : <><X className="size-4" /> Remove</>}
          </Button>
        )}
      </div>
    );
  }

  if (!invoice.accepts_coupon) return null;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline">
        <TicketPercent className="size-4" /> Have a discount code?
      </button>
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!code.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await apply(code.trim());
      if (result.ok) {
        toast.success(result.message);
        setCode("");
        setOpen(false);
      } else {
        setError(result.errors?.code?.[0] ?? result.message ?? "We couldn't apply that code.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-1.5">
      <label htmlFor="coupon-code" className="text-sm font-medium text-foreground">
        Discount code
      </label>
      <div className="flex gap-2">
        <input
          id="coupon-code"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="e.g. LAUNCH20"
          autoComplete="off"
          autoFocus
          maxLength={40}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "coupon-error" : undefined}
          className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 font-mono uppercase tracking-wider text-foreground placeholder:font-sans placeholder:normal-case placeholder:tracking-normal focus:border-brand-500 focus:outline-none"
        />
        <Button type="submit" variant="outline" disabled={pending || !code.trim()}>
          {pending ? <DotLoader className="text-current" label="Checking code" /> : "Apply"}
        </Button>
      </div>
      {error && (
        <p id="coupon-error" className="text-[13px] text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
