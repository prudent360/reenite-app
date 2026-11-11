"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, Search, UserPlus, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, Card, CardHeader } from "@/components/ui/card";
import { SelectField, TextField, TextareaField } from "@/components/ui/form";
import { DotLoader } from "@/components/ui/loader";
import { createAppointment, searchAppointmentClients, updateAppointment, type AppointmentInput } from "@/lib/actions/appointments";
import { describeHistory, lagosDateAndTime, punctualityConcern } from "@/lib/appointment-format";
import type { Appointment, AppointmentClient } from "@/lib/types";
import { cn } from "@/lib/utils";

const durations = [15, 30, 45, 60, 90, 120, 180];

const detailHints: Record<string, string> = {
  in_person: "Optional. Leave empty to use the office address.",
  phone: "Optional. Leave empty and we'll say you'll call their number.",
  video: "Paste the meeting link, e.g. a Google Meet or Zoom link.",
};

/** Today in Lagos, for the date picker's minimum. */
const lagosToday = () => lagosDateAndTime(new Date().toISOString()).date;

/**
 * Books a new appointment, or edits one (`appointment` given). Editing can't change the client;
 * a new time tells the client and resets their confirmation.
 */
export function AppointmentForm({ staff, appointment }: { staff: { id: number; name: string }[]; appointment?: Appointment }) {
  const router = useRouter();
  const editing = Boolean(appointment);
  const start = appointment ? lagosDateAndTime(appointment.starts_at) : { date: "", time: "" };

  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<AppointmentClient[]>([]);
  const [searching, startSearch] = useTransition();
  const [chosen, setChosen] = useState<AppointmentClient | null>(null);
  const [newClient, setNewClient] = useState({ name: "", email: "", phone: "", whatsapp_consent: false });

  const [form, setForm] = useState({
    title: appointment?.title ?? "",
    mode: appointment?.mode ?? "in_person",
    meeting_details: appointment?.custom_meeting_details ?? "",
    date: start.date,
    time: start.time,
    duration_minutes: String(appointment?.duration_minutes ?? 30),
    assigned_to: appointment?.assigned_to ? String(appointment.assigned_to) : "",
    staff_notes: appointment?.staff_notes ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, startSaving] = useTransition();
  const set = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));
  const error = (key: string) => errors[key]?.[0];

  // Look up existing clients as staff type.
  useEffect(() => {
    if (editing || clientMode !== "existing" || search.trim().length < 2) {
      return;
    }
    const timer = setTimeout(() => {
      startSearch(async () => {
        const result = await searchAppointmentClients(search.trim());
        setResults(result.ok ? (result.data ?? []) : []);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [search, clientMode, editing]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    const details: Omit<AppointmentInput, "client" | "client_id"> = {
      title: form.title,
      mode: form.mode,
      meeting_details: form.meeting_details.trim() || null,
      starts_at: `${form.date} ${form.time}`,
      duration_minutes: Number(form.duration_minutes),
      assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
      staff_notes: form.staff_notes.trim() || null,
    };

    startSaving(async () => {
      if (appointment) {
        const result = await updateAppointment(appointment.reference, details);
        if (result.ok) {
          toast.success(result.data && result.data.starts_at !== appointment.starts_at ? "Saved. The client has been sent the new time." : "Saved.");
          router.push(`/admin/appointments/${appointment.reference}`);
        } else {
          setErrors(result.errors ?? {});
          toast.error(result.message ?? "Please check the highlighted fields.");
        }
        return;
      }

      if (clientMode === "existing" && !chosen) {
        setErrors({ client_id: ["Choose a client, or add a new one."] });
        return;
      }
      const result = await createAppointment({
        ...details,
        ...(clientMode === "existing" ? { client_id: chosen!.id } : { client: { ...newClient, email: newClient.email.trim().toLowerCase() } }),
      });
      if (result.ok && result.data) {
        toast.success(result.message);
        router.push(`/admin/appointments/${result.data.reference}`);
      } else {
        setErrors(result.errors ?? {});
        toast.error(result.message ?? "Please check the highlighted fields.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        {!editing && (
          <Card>
            <CardHeader title="Client" description="They'll get the confirmation and reminders by email, and on WhatsApp if they agree." />
            <div className="space-y-4 p-5 sm:p-6">
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Client">
                {(
                  [
                    { key: "existing", label: "Existing client", icon: UserRound },
                    { key: "new", label: "New client", icon: UserPlus },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    role="radio"
                    aria-checked={clientMode === option.key}
                    onClick={() => setClientMode(option.key)}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition",
                      clientMode === option.key ? "border-brand-500 text-foreground ring-1 ring-brand-500" : "border-border text-muted hover:border-navy-200",
                    )}
                  >
                    <option.icon className="size-4" /> {option.label}
                  </button>
                ))}
              </div>

              {clientMode === "existing" ? (
                chosen ? (
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3 rounded-xl border border-border p-4">
                      <div className="min-w-0 text-sm">
                        <p className="font-semibold text-foreground">{chosen.name}</p>
                        <p className="text-muted">
                          {chosen.phone ?? "No phone"} · {chosen.email}
                        </p>
                        <p className="mt-1 text-xs text-muted">{describeHistory(chosen.history) ?? "No past appointments."}</p>
                      </div>
                      <button type="button" onClick={() => setChosen(null)} aria-label="Choose a different client" className="text-muted hover:text-foreground">
                        <X className="size-4" />
                      </button>
                    </div>
                    {punctualityConcern(chosen.history) && (
                      <Alert tone="warning" icon={AlertTriangle}>
                        This client is often late or misses appointments. Consider calling the day before.
                      </Alert>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="relative block">
                      <span className="sr-only">Find a client</span>
                      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search by name, phone or email"
                        className="h-11 w-full rounded-xl border border-border bg-surface pl-10 pr-3 text-sm text-foreground focus:border-brand-500 focus:outline-none"
                      />
                    </label>
                    {searching && <DotLoader label="Searching" />}
                    {!searching && search.trim().length >= 2 && results.length === 0 && (
                      <p className="text-sm text-muted">
                        No client found.{" "}
                        <button type="button" className="font-semibold text-brand-600 hover:underline" onClick={() => setClientMode("new")}>
                          Add them as a new client
                        </button>
                      </p>
                    )}
                    {results.length > 0 && search.trim().length >= 2 && (
                      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                        {results.map((client) => (
                          <li key={client.id}>
                            <button type="button" onClick={() => setChosen(client)} className="w-full px-4 py-3 text-left text-sm hover:bg-surface-muted">
                              <span className="font-semibold text-foreground">{client.name}</span>
                              <span className="block text-muted">
                                {client.phone ?? "No phone"} · {client.email}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {error("client_id") && <p className="text-[13px] text-danger">{error("client_id")}</p>}
                  </div>
                )
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="Full name" name="client_name" value={newClient.name} onChange={(event) => setNewClient((value) => ({ ...value, name: event.target.value }))} error={errors["client.name"]} required className="sm:col-span-2" />
                  <TextField label="Phone number" name="client_phone" type="tel" value={newClient.phone} onChange={(event) => setNewClient((value) => ({ ...value, phone: event.target.value }))} error={errors["client.phone"]} placeholder="0803 123 4567" required />
                  <TextField label="Email address" name="client_email" type="email" value={newClient.email} onChange={(event) => setNewClient((value) => ({ ...value, email: event.target.value }))} error={errors["client.email"]} required />
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 text-sm sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={newClient.whatsapp_consent}
                      onChange={(event) => setNewClient((value) => ({ ...value, whatsapp_consent: event.target.checked }))}
                      className="mt-0.5 size-4 accent-brand-500"
                    />
                    <span>
                      <span className="font-semibold text-foreground">The client agreed to WhatsApp reminders</span>
                      <span className="block text-muted">Only tick this if they said yes. Email reminders go out either way.</span>
                    </span>
                  </label>
                </div>
              )}
            </div>
          </Card>
        )}

        <Card>
          <CardHeader title="Appointment" />
          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
            <TextField label="What it's for" name="title" value={form.title} onChange={set("title")} error={errors["title"]} placeholder="e.g. CAC document review" required className="sm:col-span-2" />
            <TextField label="Date" name="date" type="date" min={lagosToday()} value={form.date} onChange={set("date")} required />
            <TextField label="Start time" name="time" type="time" step={300} value={form.time} onChange={set("time")} error={errors["starts_at"]} required />
            <SelectField label="Length" name="duration_minutes" value={form.duration_minutes} onChange={set("duration_minutes")} error={errors["duration_minutes"]}>
              {durations.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes < 60 ? `${minutes} minutes` : `${minutes / 60} hour${minutes === 60 ? "" : "s"}`}
                </option>
              ))}
            </SelectField>
            <SelectField label="With" name="assigned_to" value={form.assigned_to} onChange={set("assigned_to")} error={errors["assigned_to"]}>
              <option value="">Anyone on the team</option>
              {staff.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </SelectField>
            <SelectField label="How" name="mode" value={form.mode} onChange={set("mode")} error={errors["mode"]} className="sm:col-span-2">
              <option value="in_person">In person</option>
              <option value="phone">Phone call</option>
              <option value="video">Video call</option>
            </SelectField>
            <TextareaField
              label={form.mode === "video" ? "Meeting link" : form.mode === "phone" ? "Call details" : "Where"}
              name="meeting_details"
              rows={2}
              value={form.meeting_details}
              onChange={set("meeting_details")}
              error={errors["meeting_details"]}
              hint={detailHints[form.mode]}
              className="sm:col-span-2"
            />
          </div>
        </Card>
      </div>

      <div className="space-y-6 lg:sticky lg:top-24">
        <Card className="space-y-4 p-5">
          <TextareaField label="Notes for staff" name="staff_notes" rows={4} value={form.staff_notes} onChange={set("staff_notes")} hint="Never shown to the client." />
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? <DotLoader className="text-current" label="Saving" /> : editing ? "Save changes" : "Book and notify client"}
          </Button>
          <p className="text-xs leading-relaxed text-muted">
            {editing
              ? "Changing the date or time sends the client the new time and asks them to confirm again."
              : "The client gets a confirmation now, a reminder the day before and another an hour before, each with your timekeeping rule."}
          </p>
        </Card>
      </div>
    </form>
  );
}
