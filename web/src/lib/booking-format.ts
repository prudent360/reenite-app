import type { Booking, BookingStatus } from "./types";

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
