import type { Appointment, ClientHistory } from "@/lib/types";

const dateFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", hour: "numeric", minute: "2-digit", hour12: true });
const partsFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

const time = (iso: string) => timeFormat.format(new Date(iso)).replace(/\s/g, "").toLowerCase();

/** "Thu, 12 Nov 2026 · 10:00am to 10:45am" in Lagos time. */
export function formatAppointmentWhen(appointment: Pick<Appointment, "starts_at" | "ends_at">): string {
  return `${dateFormat.format(new Date(appointment.starts_at))} · ${time(appointment.starts_at)} to ${time(appointment.ends_at)}`;
}

/** The Lagos date ("2026-11-12") and time ("10:00") of an instant, for date and time inputs. */
export function lagosDateAndTime(iso: string): { date: string; time: string } {
  const parts = Object.fromEntries(partsFormat.formatToParts(new Date(iso)).map((part) => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

export function appointmentTone(appointment: Pick<Appointment, "status" | "minutes_late" | "response" | "ends_at">): "warning" | "success" | "info" | "neutral" | "danger" {
  if (appointment.status === "no_show") return "danger";
  if (appointment.status === "cancelled") return "neutral";
  if (appointment.status === "attended") return (appointment.minutes_late ?? 0) > 0 ? "warning" : "success";
  if (appointment.response === "reschedule_requested" || new Date(appointment.ends_at) <= new Date()) return "warning";
  return "info";
}

export const responseLabels = { confirmed: "Client confirmed", reschedule_requested: "Asked to reschedule" } as const;

/** "4 appointments: 2 on time, 1 late (avg 12 min), 1 no-show", or null for new clients. */
export function describeHistory(history: ClientHistory | undefined): string | null {
  if (!history || history.total === 0) return null;
  const parts = [
    history.on_time > 0 ? `${history.on_time} on time` : null,
    history.late > 0 ? `${history.late} late${history.average_minutes_late ? ` (avg ${history.average_minutes_late} min)` : ""}` : null,
    history.no_show > 0 ? `${history.no_show} no-show${history.no_show === 1 ? "" : "s"}` : null,
  ].filter(Boolean);
  return `${history.total} past appointment${history.total === 1 ? "" : "s"}: ${parts.join(", ")}`;
}

/** Flags clients who are late or miss appointments often enough to mention. */
export function punctualityConcern(history: ClientHistory | undefined): boolean {
  return Boolean(history && history.total >= 2 && (history.late + history.no_show) / history.total >= 0.5);
}
