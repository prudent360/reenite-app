import Link from "next/link";
import { formatBookingTime } from "@/lib/booking-format";
import type { AdminBookingDay, BookingStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const blockTones: Record<BookingStatus, string> = {
  held: "border-warning/40 bg-warning-soft text-warning",
  pending_approval: "border-info/40 bg-info-soft text-info",
  confirmed: "border-success/40 bg-success-soft text-success",
  checked_in: "border-navy-700 bg-navy-900 text-white dark:bg-navy-700",
  completed: "border-border bg-surface-muted text-muted",
  expired: "border-border bg-surface-muted text-muted",
  cancelled: "border-border bg-surface-muted text-muted",
};

const START_HOUR = 7;
const END_HOUR = 22;
const SPAN_MINUTES = (END_HOUR - START_HOUR) * 60;

/** Minutes after midnight in Uyo for an ISO time, clamped to the day being shown. */
function minutesInDay(iso: string, date: string, edge: "start" | "end"): number {
  const local = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const part = (type: string) => local.find((item) => item.type === type)?.value ?? "0";
  const day = `${part("year")}-${part("month")}-${part("day")}`;
  if (day < date) return 0;
  if (day > date) return edge === "end" ? 24 * 60 : 0;
  return Number(part("hour")) * 60 + Number(part("minute"));
}

/** Each space as a row, with that day's bookings as blocks between 7am and 10pm. */
export function DayTimeline({ day }: { day: AdminBookingDay }) {
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => START_HOUR + index);

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      <div className="min-w-[860px]">
        <div className="grid grid-cols-[180px_1fr] border-b border-border text-xs text-muted">
          <div className="px-4 py-2 font-semibold">Space</div>
          <div className="relative h-8">
            {hours.map((hour) => (
              <span key={hour} className="absolute top-2 -translate-x-1/2" style={{ left: `${((hour - START_HOUR) * 60 * 100) / SPAN_MINUTES}%` }}>
                {hour === 12 ? "12pm" : hour > 12 ? `${hour - 12}pm` : `${hour}am`}
              </span>
            ))}
          </div>
        </div>
        {day.locations.flatMap((location) =>
          location.spaces.map((space) => (
            <div key={space.id} className="grid grid-cols-[180px_1fr] border-b border-border last:border-0">
              <div className="px-4 py-3">
                <p className="truncate text-sm font-semibold text-foreground">{space.name}</p>
                <p className="text-xs text-muted">{space.is_shared ? `${space.capacity} seats` : `Up to ${space.capacity}`}</p>
              </div>
              <div className="relative min-h-14">
                {hours.map((hour) => (
                  <span key={hour} aria-hidden className="absolute inset-y-0 w-px bg-border/70" style={{ left: `${((hour - START_HOUR) * 60 * 100) / SPAN_MINUTES}%` }} />
                ))}
                {space.bookings.map((booking, index) => {
                  const from = Math.max(START_HOUR * 60, minutesInDay(booking.starts_at, day.date, "start"));
                  const to = Math.min(END_HOUR * 60, minutesInDay(booking.ends_at, day.date, "end"));
                  if (to <= from) return null;
                  // Shared spaces can hold several bookings at once; stagger them so each stays visible.
                  const lane = space.is_shared ? index % 3 : 0;
                  return (
                    <Link
                      key={booking.reference}
                      href={`/admin/bookings/${booking.reference}`}
                      title={`${booking.customer} · ${formatBookingTime(booking.starts_at)} to ${formatBookingTime(booking.ends_at)} · ${booking.status_label}`}
                      className={cn("absolute h-9 overflow-hidden rounded-lg border px-2 py-1 text-[11px] leading-tight transition hover:z-10 hover:shadow-pop", blockTones[booking.status])}
                      style={{
                        left: `${((from - START_HOUR * 60) * 100) / SPAN_MINUTES}%`,
                        width: `${((to - from) * 100) / SPAN_MINUTES}%`,
                        top: `${8 + lane * 6}px`,
                      }}
                    >
                      <span className="block truncate font-semibold">{booking.customer}</span>
                      <span className="block truncate opacity-80">
                        {formatBookingTime(booking.starts_at)}
                        {space.is_shared ? ` · ${booking.seats} seat${booking.seats === 1 ? "" : "s"}` : ""}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )),
        )}
      </div>
    </div>
  );
}
