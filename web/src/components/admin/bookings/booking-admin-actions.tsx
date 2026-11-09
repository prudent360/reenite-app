"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { TextareaField } from "@/components/ui/form";
import { DotLoader } from "@/components/ui/loader";
import { approveBooking, cancelBookingAsStaff, checkInBooking, declineBooking } from "@/lib/actions/bookings";
import type { Booking, FormState } from "@/lib/types";
import { formatNaira } from "@/lib/utils";

const refundChoices = [100, 75, 50, 25, 0];

/** Check in, approve or decline, or cancel with a chosen refund. */
export function BookingAdminActions({ booking, canManage }: { booking: Booking; canManage: boolean }) {
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"cancel" | "decline" | null>(null);
  const [reason, setReason] = useState("");
  const [refund, setRefund] = useState(100);
  const paid = booking.invoice ? booking.invoice.amount_paid - booking.invoice.amount_refunded : 0;

  function run(action: () => Promise<FormState>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(result.message);
        setMode(null);
      } else toast.error(result.message ?? Object.values(result.errors ?? {})[0]?.[0] ?? "That didn't work.");
    });
  }

  return (
    <Card>
      <CardHeader title="Actions" />
      <div className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap gap-2">
          {booking.status === "confirmed" && (
            <Button onClick={() => run(() => checkInBooking(booking.reference))} disabled={pending}>
              Check in
            </Button>
          )}
          {canManage && booking.status === "pending_approval" && (
            <>
              <Button onClick={() => run(() => approveBooking(booking.reference))} disabled={pending}>
                Approve
              </Button>
              <Button variant="outline" onClick={() => setMode("decline")} disabled={pending}>
                Decline
              </Button>
            </>
          )}
          {canManage && ["held", "confirmed"].includes(booking.status) && (
            <Button variant="outline" onClick={() => setMode("cancel")} disabled={pending}>
              Cancel booking
            </Button>
          )}
        </div>

        {mode && (
          <div className="space-y-4 rounded-xl border border-border p-4">
            <TextareaField
              label={mode === "decline" ? "Why are you declining it?" : "Why is it being cancelled?"}
              name="reason"
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              hint="The customer sees this in their email."
            />
            {mode === "cancel" && paid > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Refund</p>
                <div className="flex flex-wrap gap-2">
                  {refundChoices.map((percent) => (
                    <button
                      key={percent}
                      type="button"
                      onClick={() => setRefund(percent)}
                      className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${refund === percent ? "border-brand-500 bg-brand-500 text-white" : "border-border text-foreground"}`}
                    >
                      {percent}% · {formatNaira(Math.floor((paid * percent) / 100))}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted">
                  Policy right now: {formatNaira(booking.refund_preview ?? 0)}. Card payments are refunded automatically; bank transfers are refunded by hand from Finance.
                </p>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="danger"
                disabled={pending || reason.trim().length === 0}
                onClick={() => run(() => (mode === "decline" ? declineBooking(booking.reference, reason) : cancelBookingAsStaff(booking.reference, reason, paid > 0 ? refund : 0)))}
              >
                {pending ? <DotLoader className="text-current" label="Working" /> : mode === "decline" ? "Decline request" : "Cancel booking"}
              </Button>
              <Button variant="ghost" onClick={() => setMode(null)} disabled={pending}>
                Back
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
