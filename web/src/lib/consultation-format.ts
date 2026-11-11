import type { Consultation } from "@/lib/types";

const dateFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", hour: "numeric", minute: "2-digit", hour12: true });

const time = (iso: string) => timeFormat.format(new Date(iso)).replace(/\s/g, "").toLowerCase();

/** "Thu, 12 Nov 2026 · 10:00am to 11:00am" in Lagos time. */
export function formatConsultationWhen(consultation: Pick<Consultation, "starts_at" | "ends_at">): string {
  return `${dateFormat.format(new Date(consultation.starts_at))} · ${time(consultation.starts_at)} to ${time(consultation.ends_at)}`;
}

export const consultationTones: Record<Consultation["status"], "warning" | "success" | "info" | "neutral" | "danger"> = {
  pending_payment: "warning",
  confirmed: "success",
  completed: "info",
  no_show: "danger",
  cancelled: "neutral",
  expired: "neutral",
};
