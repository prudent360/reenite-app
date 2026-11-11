"use client";

import { useState, useTransition } from "react";
import { CalendarCheck, CalendarClock, CalendarX, CheckCircle2, Clock, MapPin, RefreshCw, UserRound, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TextareaField } from "@/components/ui/form";
import { DotLoader } from "@/components/ui/loader";
import { respondToAppointment } from "@/lib/actions/appointments";
import { formatAppointmentWhen } from "@/lib/appointment-format";
import { hq } from "@/content/site";
import type { ClientAppointment } from "@/lib/types";

/**
 * The client's appointment on one card: what and when, the timekeeping rule, and two choices,
 * "I'll be there" or "I need another time".
 */
export function ClientAppointmentCard({ appointment: initial, token }: { appointment: ClientAppointment; token: string }) {
  const [appointment, setAppointment] = useState(initial);
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function respond(response: "confirmed" | "reschedule_requested") {
    startTransition(async () => {
      const result = await respondToAppointment(appointment.reference, token, response, note.trim());
      if (result.ok && result.data) {
        setAppointment(result.data);
        setAsking(false);
      } else {
        toast.error(result.message ?? "We couldn't save your answer. Please call us.");
      }
    });
  }

  const headline = (() => {
    if (appointment.status === "cancelled") return { icon: CalendarX, tone: "bg-danger-soft text-danger", title: "This appointment was cancelled", body: "We'll be in touch if we need to arrange another time." };
    if (!appointment.can_respond) return { icon: CalendarCheck, tone: "bg-navy-50 text-foreground", title: "This appointment has passed", body: "Thanks for meeting with us." };
    if (appointment.response === "confirmed") return { icon: CheckCircle2, tone: "bg-success-soft text-success", title: "You're confirmed. See you then!", body: "We'll remind you again shortly before it starts." };
    if (appointment.response === "reschedule_requested") return { icon: RefreshCw, tone: "bg-warning-soft text-warning", title: "We've got your request", body: "Our team will contact you to agree a new time." };
    return { icon: CalendarClock, tone: "bg-info-soft text-info", title: `${appointment.client_first_name ? `${appointment.client_first_name}, can` : "Can"} you make it?`, body: "Please let us know, so we can keep the time for you." };
  })();

  const ModeIcon = appointment.mode === "video" ? Video : MapPin;

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
      <header className="flex items-start gap-4 p-6 sm:p-8">
        <span className={`flex size-11 shrink-0 items-center justify-center rounded-full ${headline.tone}`}>
          <headline.icon className="size-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{headline.title}</h1>
          <p className="mt-1 text-muted">{headline.body}</p>
        </div>
      </header>

      <div className="border-t border-border p-6 sm:p-8">
        <p className="text-lg font-bold text-foreground">{appointment.title}</p>
        <p className="mt-0.5 font-mono text-xs text-muted">{appointment.reference}</p>
        <dl className="mt-5 space-y-2.5 text-[15px]">
          <div className="flex gap-3">
            <Clock className="mt-0.5 size-4 shrink-0 text-muted" />
            <dt className="sr-only">When</dt>
            <dd className="text-foreground">{formatAppointmentWhen(appointment)}</dd>
          </div>
          <div className="flex gap-3">
            <ModeIcon className="mt-0.5 size-4 shrink-0 text-muted" />
            <dt className="sr-only">How</dt>
            <dd className="text-foreground">
              {appointment.mode_label}
              <span className="block whitespace-pre-line break-words text-muted">{appointment.meeting_details}</span>
            </dd>
          </div>
          {appointment.staff_name && (
            <div className="flex gap-3">
              <UserRound className="mt-0.5 size-4 shrink-0 text-muted" />
              <dt className="sr-only">With</dt>
              <dd className="text-foreground">With {appointment.staff_name}</dd>
            </div>
          )}
        </dl>
        {appointment.can_respond && appointment.status !== "cancelled" && (
          <p className="mt-6 rounded-xl bg-surface-muted p-4 text-sm font-medium text-foreground">{appointment.punctuality}</p>
        )}
      </div>

      {appointment.can_respond && appointment.status !== "cancelled" && (
        <footer className="space-y-3 border-t border-border px-6 py-5 sm:px-8">
          {asking ? (
            <>
              <TextareaField label="Anything we should know?" name="note" rows={2} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} hint="Optional, e.g. days or times that suit you." />
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={() => respond("reschedule_requested")} disabled={pending}>
                  {pending ? <DotLoader className="text-current" label="Sending" /> : "Ask for another time"}
                </Button>
                <Button variant="outline" onClick={() => setAsking(false)} disabled={pending}>
                  Back
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              {appointment.response !== "confirmed" && (
                <Button size="lg" onClick={() => respond("confirmed")} disabled={pending}>
                  {pending ? <DotLoader className="text-current" label="Confirming" /> : "I'll be there"}
                </Button>
              )}
              {appointment.response !== "reschedule_requested" && (
                <Button size="lg" variant="outline" onClick={() => setAsking(true)} disabled={pending}>
                  I need another time
                </Button>
              )}
            </div>
          )}
          <p className="text-xs text-muted">
            Questions? Call{" "}
            <a href={hq.phoneHref} className="font-semibold text-foreground hover:underline">
              {hq.phone}
            </a>
            .
          </p>
        </footer>
      )}
    </article>
  );
}
