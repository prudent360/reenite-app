"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { TextareaField } from "@/components/ui/form";
import { DotLoader } from "@/components/ui/loader";
import { cancelBooking } from "@/lib/actions/bookings";
import type { Booking } from "@/lib/types";
import { formatNaira } from "@/lib/utils";

/** Cancel with a confirmation step that states the refund first. */
export function CancelBooking({ booking, token }: { booking: Booking; token: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const paid = booking.invoice ? booking.invoice.amount_paid - booking.invoice.amount_refunded : 0;
  const refund = booking.refund_preview ?? 0;

  const outcome =
    booking.status === "held" || booking.status === "pending_approval"
      ? "Nothing has been paid, so there's nothing to refund."
      : booking.paid_via === "pass"
        ? refund > 0 || paid === 0
          ? "Your pass credits will be returned."
          : "Under the cancellation policy, your pass credits won't be returned."
        : refund > 0
          ? `You'll be refunded ${formatNaira(refund)}${booking.paid_via === "online" ? " to your card or account" : ""}.`
          : "Under the cancellation policy, this booking isn't refundable any more.";

  function confirm() {
    startTransition(async () => {
      const result = await cancelBooking(booking.reference, token, reason);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message ?? "We couldn't cancel this booking.");
    });
  }

  return (
    <Card>
      <CardHeader title="Need to cancel?" description={outcome} />
      <div className="space-y-4 p-5 sm:p-6">
        {open ? (
          <>
            <TextareaField label="Reason" name="reason" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} hint="Optional. Helps us improve." />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="danger" onClick={confirm} disabled={pending}>
                {pending ? <DotLoader className="text-current" label="Cancelling" /> : "Yes, cancel my booking"}
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Keep my booking
              </Button>
            </div>
          </>
        ) : (
          <Button variant="outline" onClick={() => setOpen(true)}>
            Cancel booking
          </Button>
        )}
      </div>
    </Card>
  );
}
