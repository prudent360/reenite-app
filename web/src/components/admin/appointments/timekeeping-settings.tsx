"use client";

import { useState, useTransition } from "react";
import { Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { TextField } from "@/components/ui/form";
import { DotLoader } from "@/components/ui/loader";
import { saveAppointmentSettings } from "@/lib/actions/appointments";
import type { AppointmentSettings } from "@/lib/types";

/** The timekeeping rule written into every appointment message, with a live preview. */
export function TimekeepingSettings({ settings }: { settings: AppointmentSettings }) {
  const [early, setEarly] = useState(String(settings.arrive_early_minutes));
  const [grace, setGrace] = useState(String(settings.grace_minutes));
  const [pending, startTransition] = useTransition();

  const earlyMinutes = Math.max(0, Number(early) || 0);
  const graceMinutes = Math.max(0, Number(grace) || 0);
  const preview = [
    earlyMinutes > 0 ? `Please arrive ${earlyMinutes} ${earlyMinutes === 1 ? "minute" : "minutes"} early.` : "Please be on time.",
    graceMinutes > 0 ? `If you're more than ${graceMinutes} ${graceMinutes === 1 ? "minute" : "minutes"} late, we may need to reschedule.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  function save(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveAppointmentSettings({ arrive_early_minutes: earlyMinutes, grace_minutes: graceMinutes });
      if (result.ok) toast.success(result.message);
      else toast.error(Object.values(result.errors ?? {})[0]?.[0] ?? result.message ?? "We couldn't save that.");
    });
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader title="Timekeeping rule" description="Shown in the confirmation and both reminders, so clients know what's expected." />
      <form onSubmit={save} className="space-y-5 p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Arrive early by (minutes)" name="arrive_early_minutes" type="number" min={0} max={120} value={early} onChange={(event) => setEarly(event.target.value)} hint="0 to just ask them to be on time" />
          <TextField label="Grace period (minutes)" name="grace_minutes" type="number" min={0} max={120} value={grace} onChange={(event) => setGrace(event.target.value)} hint="After this, you may reschedule" />
        </div>
        <div className="flex gap-3 rounded-xl bg-surface-muted p-4 text-sm">
          <Clock className="mt-0.5 size-4 shrink-0 text-brand-500" />
          <p className="text-foreground">
            <span className="block text-xs font-semibold text-muted">Clients will read</span>
            {preview}
          </p>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? <DotLoader className="text-current" label="Saving" /> : "Save rule"}
        </Button>
      </form>
    </Card>
  );
}
