"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { TextField, TextareaField } from "@/components/ui/form";
import { DotLoader } from "@/components/ui/loader";
import { cancelAppointment, recordAppointmentOutcome } from "@/lib/actions/appointments";
import type { Appointment, FormState } from "@/lib/types";

/**
 * What staff can do next: before it starts, change or cancel it; once it has started, record
 * whether the client came on time, late or not at all.
 */
export function AppointmentActions({ appointment }: { appointment: Appointment }) {
  const [pending, startTransition] = useTransition();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [late, setLate] = useState(false);
  const [minutesLate, setMinutesLate] = useState("10");

  const started = new Date(appointment.starts_at) <= new Date();
  const run = (action: () => Promise<FormState>) =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(result.message);
      else toast.error(Object.values(result.errors ?? {})[0]?.[0] ?? result.message ?? "Something went wrong.");
    });

  if (appointment.status === "cancelled") {
    return null;
  }

  // Already recorded: allow correcting it.
  const recorded = appointment.status === "attended" || appointment.status === "no_show";

  if (started || recorded) {
    return (
      <Card>
        <CardHeader title={recorded ? "Change how it went" : "How did it go?"} description={recorded ? `Recorded: ${appointment.status_label}.` : "Recording lateness builds up the client's punctuality history."} />
        <div className="space-y-3 p-5 sm:p-6">
          <div className="grid gap-2 sm:grid-cols-3">
            <Button variant="outline" disabled={pending} onClick={() => run(() => recordAppointmentOutcome(appointment.reference, "attended", 0))}>
              On time
            </Button>
            <Button variant="outline" disabled={pending} onClick={() => setLate((value) => !value)} aria-expanded={late}>
              Late
            </Button>
            <Button variant="outline" disabled={pending} onClick={() => run(() => recordAppointmentOutcome(appointment.reference, "no_show", 0))}>
              No-show
            </Button>
          </div>
          {late && (
            <div className="flex items-end gap-2">
              <TextField label="Minutes late" name="minutes_late" type="number" min={1} max={600} value={minutesLate} onChange={(event) => setMinutesLate(event.target.value)} className="flex-1" />
              <Button disabled={pending} onClick={() => run(() => recordAppointmentOutcome(appointment.reference, "attended", Math.max(1, Number(minutesLate) || 1)))} className="mb-px">
                {pending ? <DotLoader className="text-current" label="Saving" /> : "Save"}
              </Button>
            </div>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Change or cancel" />
      <div className="space-y-3 p-5 sm:p-6">
        <ButtonLink href={`/admin/appointments/${appointment.reference}/edit`} variant="outline" className="w-full">
          Change time or details
        </ButtonLink>
        {cancelling ? (
          <div className="space-y-3">
            <TextareaField label="Reason" name="reason" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} hint="Sent to the client." />
            <div className="flex gap-2">
              <Button variant="danger" size="sm" disabled={pending || reason.trim() === ""} onClick={() => run(() => cancelAppointment(appointment.reference, reason.trim()))}>
                {pending ? <DotLoader className="text-current" label="Cancelling" /> : "Cancel appointment"}
              </Button>
              <Button variant="outline" size="sm" disabled={pending} onClick={() => setCancelling(false)}>
                Keep it
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" className="w-full text-danger" onClick={() => setCancelling(true)}>
            Cancel appointment
          </Button>
        )}
      </div>
    </Card>
  );
}
