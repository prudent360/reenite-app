import Link from "next/link";
import { BookingRowActions } from "@/components/admin/bookings/booking-row-actions";
import { BookingStatusBadge } from "@/components/booking/booking-parts";
import { Badge } from "@/components/ui/card";
import { formatBookingTime } from "@/lib/booking-format";
import type { Booking } from "@/lib/types";
import { cn, formatNaira } from "@/lib/utils";

const dateFormat = new Intl.DateTimeFormat("en-NG", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" });

const paidVia: Record<NonNullable<Booking["paid_via"]>, string> = {
  online: "Online",
  bank_transfer: "Bank transfer",
  desk: "At the desk",
  pass: "Pass credits",
  free: "No charge",
  coupon: "Discount code",
};

/** "3 hours", "1 day", "2 weeks". */
function length(booking: Booking): string {
  return `${booking.quantity} ${booking.rate_unit}${booking.quantity === 1 ? "" : "s"}`;
}

function When({ booking }: { booking: Booking }) {
  const start = new Date(booking.starts_at);
  const end = new Date(new Date(booking.ends_at).getTime() - 1);
  const sameDay = dayKey.format(start) === dayKey.format(end);
  return (
    <>
      <span className="block whitespace-nowrap font-medium text-foreground">{dateFormat.format(start)}</span>
      <span className="block whitespace-nowrap text-muted">
        {sameDay ? `${formatBookingTime(booking.starts_at)} to ${formatBookingTime(booking.ends_at)}` : `to ${dateFormat.format(end)}`}
      </span>
    </>
  );
}

function Payment({ booking }: { booking: Booking }) {
  if (booking.pending_transfer) return <Badge tone="info">Transfer to check</Badge>;
  if (booking.paid_via) return <span className="text-foreground">{paidVia[booking.paid_via]}</span>;
  if (booking.status === "held") return <span className="text-warning">Not paid yet</span>;
  return <span className="text-muted">—</span>;
}

/** Every booking as a row: who, which space, when, how they paid, and what staff can do about it. */
export function BookingTable({ bookings, canManage }: { bookings: Booking[]; canManage: boolean }) {
  return (
    <>
      {/* Phones get stacked cards; the table needs room. */}
      <ul className="divide-y divide-border md:hidden">
        {bookings.map((booking) => (
          <li key={booking.reference} className={cn("space-y-2 px-4 py-4", booking.pending_transfer || booking.status === "pending_approval" ? "bg-info-soft/40" : "")}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{booking.customer?.name ?? "Customer"}</p>
                <p className="truncate text-sm text-muted">{booking.customer?.email}</p>
              </div>
              <BookingStatusBadge booking={booking} />
            </div>
            <p className="text-sm text-foreground">
              {booking.space_name} <span className="text-muted">· {booking.location_name}</span>
            </p>
            <div className="text-sm"><When booking={booking} /> <span className="text-muted">{length(booking)}</span></div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <Payment booking={booking} />
              <span className="font-semibold text-foreground">{formatNaira(booking.invoice?.total ?? booking.total)}</span>
            </div>
            <BookingRowActions booking={booking} canManage={canManage} className="flex-wrap justify-start" />
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="bg-surface-muted text-xs font-semibold uppercase tracking-wider text-muted">
            <tr>
              <th className="px-5 py-3">Customer</th>
              <th className="px-5 py-3">Space</th>
              <th className="px-5 py-3">Date and time</th>
              <th className="px-5 py-3">Amount</th>
              <th className="px-5 py-3">Payment</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {bookings.map((booking) => (
              <tr key={booking.reference} className={cn("align-top", booking.pending_transfer || booking.status === "pending_approval" ? "bg-info-soft/40" : "")}>
                <td className="px-5 py-3.5">
                  <Link href={`/admin/bookings/${booking.reference}`} className="font-semibold text-foreground hover:text-brand-600">
                    {booking.customer?.name ?? "Customer"}
                  </Link>
                  {booking.customer?.is_guest && <span className="ml-1.5 text-xs text-muted">Guest</span>}
                  <span className="block text-muted">{booking.customer?.email}</span>
                  {booking.customer?.phone && <span className="block text-muted">{booking.customer.phone}</span>}
                </td>
                <td className="whitespace-nowrap px-5 py-3.5">
                  <span className="block font-medium text-foreground">{booking.space_name}</span>
                  <span className="block text-muted">{booking.location_name}</span>
                  <span className="block text-muted">
                    {booking.seats} {booking.seats === 1 ? "person" : "people"}
                    {(booking.assigned_seats ?? []).length > 0 && ` · ${booking.assigned_seats!.map((seat) => seat.label).join(", ")}`}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <When booking={booking} />
                  <span className="block text-muted">{length(booking)}</span>
                </td>
                <td className="whitespace-nowrap px-5 py-3.5 font-semibold text-foreground">{formatNaira(booking.invoice?.total ?? booking.total)}</td>
                <td className="whitespace-nowrap px-5 py-3.5"><Payment booking={booking} /></td>
                <td className="whitespace-nowrap px-5 py-3.5">
                  <BookingStatusBadge booking={booking} />
                  <span className="mt-1 block font-mono text-xs text-muted">{booking.reference}</span>
                </td>
                <td className="px-5 py-3.5"><BookingRowActions booking={booking} canManage={canManage} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
