import type { Booking, BookingStatus, RateUnit } from "./types";

/** Bookings are shown in Uyo time whatever the visitor's own timezone. */
export const BOOKING_TIMEZONE = "Africa/Lagos";

const dateFormat = new Intl.DateTimeFormat("en-NG", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: BOOKING_TIMEZONE });
const timeFormat = new Intl.DateTimeFormat("en-NG", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: BOOKING_TIMEZONE });
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: BOOKING_TIMEZONE });

export function formatBookingTime(iso: string): string {
  return timeFormat.format(new Date(iso)).replace(/\s/g, "").toLowerCase();
}

/** Today's date in Uyo as YYYY-MM-DD. */
export function bookingToday(): string {
  return dayKey.format(new Date());
}

/** "Tue, 3 Nov 2026 · 10:00am to 12:00pm", or a date range for multi-day bookings. */
export function formatWhen(booking: Pick<Booking, "starts_at" | "ends_at">): string {
  const start = new Date(booking.starts_at);
  // Anything ending at midnight belongs to the day before.
  const end = new Date(new Date(booking.ends_at).getTime() - 1);
  if (dayKey.format(start) === dayKey.format(end)) {
    return `${dateFormat.format(start)} · ${formatBookingTime(booking.starts_at)} to ${formatBookingTime(booking.ends_at)}`;
  }
  return `${dateFormat.format(start)} to ${dateFormat.format(end)}`;
}

export const bookingTones: Record<BookingStatus, "warning" | "info" | "success" | "navy" | "neutral" | "danger"> = {
  held: "warning",
  pending_approval: "info",
  confirmed: "success",
  checked_in: "navy",
  completed: "neutral",
  expired: "neutral",
  cancelled: "danger",
};

/** Booking form values carried in a link, e.g. "Need more time?" or a "finish your booking" email. */
export type BookingPreset = { date?: string; start_time?: string; rate_unit?: RateUnit; quantity?: number };

/** Reads ?date=YYYY-MM-DD&start=HH:MM&unit=hour&qty=1, ignoring anything malformed. */
export function bookingPreset(query: Record<string, string | string[] | undefined>): BookingPreset {
  const value = (key: string) => (typeof query[key] === "string" ? (query[key] as string) : undefined);
  const date = value("date");
  const start = value("start");
  const unit = value("unit");
  const quantity = Number(value("qty"));
  return {
    ...(date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? { date } : {}),
    ...(start && /^\d{2}:\d{2}$/.test(start) ? { start_time: start } : {}),
    ...(unit && ["hour", "day", "week", "month"].includes(unit) ? { rate_unit: unit as RateUnit } : {}),
    ...(Number.isInteger(quantity) && quantity > 0 && quantity <= 24 ? { quantity } : {}),
  };
}
