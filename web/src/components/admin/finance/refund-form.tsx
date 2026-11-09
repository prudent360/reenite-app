"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { refundPayment } from "@/lib/actions/finance";
import type { Payment } from "@/lib/types";
import { cn, formatNaira } from "@/lib/utils";
import { Alert, Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DotLoader } from "@/components/ui/loader";
import { TextField, TextareaField } from "@/components/ui/form";

export function RefundForm({ payment }: { payment: Payment }) {
  const online = payment.gateway !== "bank_transfer";
  const [amount, setAmount] = useState(String(payment.refundable / 100));
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState<"gateway" | "manual">(online ? "gateway" : "manual");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();

  function submit() {
    const display = `₦${Number(amount.replace(/[₦,\s]/g, "")).toLocaleString()}`;
    const how = method === "gateway" ? `through ${payment.gateway_label}` : "as a manual refund (you pay it back yourself)";
    if (!window.confirm(`Refund ${display} ${how}?`)) return;
    startTransition(async () => {
      const result = await refundPayment(payment.reference, { amount, reason, method });
      setErrors(result.errors ?? {});
      if (result.ok) {
        toast.success(result.message);
        setReason("");
      } else {
        toast.error(result.message ?? "Please check the highlighted fields.");
      }
    });
  }

  return (
    <Card>
      <CardHeader title="Refund" description={`Up to ${formatNaira(payment.refundable)} can be refunded.`} />
      <div className="space-y-4 p-5">
        <div role="radiogroup" aria-label="Refund method" className="grid grid-cols-2 gap-2">
          {(["gateway", "manual"] as const).map((option) => {
            const disabled = option === "gateway" && !online;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={method === option}
                disabled={disabled}
                onClick={() => setMethod(option)}
                className={cn(
                  "rounded-xl border p-3 text-left text-sm transition disabled:opacity-50",
                  method === option ? "border-brand-500 bg-brand-50/50" : "border-border hover:border-navy-200",
                )}
              >
                <span className="block font-semibold text-foreground">{option === "gateway" ? `Via ${online ? payment.gateway_label : "gateway"}` : "Record manual refund"}</span>
                <span className="text-xs text-muted">{option === "gateway" ? "Money returns to their card or account" : "You've paid it back another way"}</span>
              </button>
            );
          })}
        </div>
        {method === "manual" && (
          <Alert tone="warning" icon={AlertTriangle}>
            This only records the refund. Make sure you&apos;ve actually sent the money back.
          </Alert>
        )}
        <TextField label="Amount" name="refund_amount" leading="₦" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} error={errors.amount} />
        <TextareaField label="Reason" name="refund_reason" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} error={errors.reason} placeholder="e.g. Name reservation rejected by CAC" />
        <Button variant="danger" className="w-full" onClick={submit} disabled={pending || !reason.trim()}>
          {pending ? <DotLoader className="text-current" /> : <><RotateCcw className="size-4" /> Refund</>}
        </Button>
      </div>
    </Card>
  );
}
