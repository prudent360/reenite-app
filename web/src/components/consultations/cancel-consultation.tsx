"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelConsultation } from "@/lib/actions/consultations";
import type { Consultation } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/form";
import { DotLoader } from "@/components/ui/loader";
import { formatDateTime, formatNaira } from "@/lib/utils";

export function CancelConsultation({ consultation }: { consultation: Consultation }) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const paid = (consultation.invoice?.amount_paid ?? 0) - (consultation.invoice?.amount_refunded ?? 0);
  const freeCancel = consultation.free_cancel;

  if (!confirming) {
    return (
      <Button variant="outline" onClick={() => setConfirming(true)}>
        Cancel consultation
      </Button>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-border p-4">
      <p className="text-sm text-foreground">
        {paid <= 0
          ? "Nothing has been paid, so there's nothing to refund."
          : freeCancel
            ? `You'll get a full refund of ${formatNaira(paid)}.`
            : `It starts within 24 hours, so there's no refund. (Full refunds were available until ${formatDateTime(consultation.free_cancel_until)}.)`}
      </p>
      <TextField label="Reason" name="reason" value={reason} onChange={(event) => setReason(event.target.value)} hint="Optional. Helps us improve." />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="danger"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await cancelConsultation(consultation.reference, reason.trim());
              if (result.ok) toast.success(result.message);
              else toast.error(result.message ?? "We couldn't cancel it.");
            })
          }
        >
          {pending ? <DotLoader className="text-current" label="Cancelling" /> : "Yes, cancel it"}
        </Button>
        <Button variant="ghost" onClick={() => setConfirming(false)}>
          Keep it
        </Button>
      </div>
    </div>
  );
}
