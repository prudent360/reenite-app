import { notFound } from "next/navigation";
import { CalendarDays, Clock, MapPin, ScanLine, Users } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { PrintButton } from "@/components/billing/print-button";
import { BookingCountdownChip } from "@/components/booking/booking-tracker";
import { ButtonLink } from "@/components/ui/button";
import { ApiError, api } from "@/lib/api";
import { BOOKING_TIMEZONE, formatBookingTime } from "@/lib/booking-format";
import type { Booking } from "@/lib/types";
import { formatNaira } from "@/lib/utils";
import { CheckInQr } from "./check-in-qr";

const longDate = new Intl.DateTimeFormat("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: BOOKING_TIMEZONE });

/**
 * The pass a customer shows at the front desk: a ticket with a QR code and the check-in code, which prints or
 * saves as a PDF on its own (the app's sidebar and header are hidden when printing).
 */
export async function BookingPass({ reference, token, backHref }: { reference: string; token: string; backHref: string }) {
  let booking: Booking;
  try {
    ({ data: booking } = await api<{ data: Booking }>(`/bookings/${encodeURIComponent(reference)}?${new URLSearchParams({ token })}`));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  // A pass only exists once the booking is confirmed.
  if (!booking.check_in_code || !["confirmed", "checked_in", "completed"].includes(booking.status)) notFound();

  const start = new Date(booking.starts_at);
  const end = new Date(new Date(booking.ends_at).getTime() - 1);
  const sameDay = longDate.format(start) === longDate.format(end);

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <ButtonLink href={backHref} variant="ghost" size="sm">
          Back to booking
        </ButtonLink>
        <PrintButton />
      </div>

      <article className="overflow-hidden rounded-3xl border border-border bg-white text-[#1a2142] shadow-pop print:border-[#1a2142] print:shadow-none">
        <header className="flex items-center justify-between bg-[#10152c] px-6 py-5 text-white">
          <Logo tone="light" href={null} className="!h-7" />
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider">Booking pass</span>
        </header>

        <div className="space-y-5 px-6 py-6">
          <div>
            <p className="text-sm text-[#5c6488]">{booking.location_name}</p>
            <h1 className="mt-1 text-3xl font-bold">{booking.space_name}</h1>
          </div>

          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="flex items-center gap-1.5 text-[#5c6488]"><CalendarDays className="size-4" /> Date</dt>
              <dd className="mt-1 font-semibold">{sameDay ? longDate.format(start) : `${longDate.format(start)} to ${longDate.format(end)}`}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-[#5c6488]"><Clock className="size-4" /> Time</dt>
              <dd className="mt-1 font-semibold">{formatBookingTime(booking.starts_at)} to {formatBookingTime(booking.ends_at)}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-[#5c6488]">
                <Users className="size-4" /> {(booking.assigned_seats ?? []).length > 0 ? ((booking.assigned_seats ?? []).length === 1 ? "Seat" : "Seats") : "People"}
              </dt>
              <dd className="mt-1 font-semibold">
                {(booking.assigned_seats ?? []).length > 0 ? (booking.assigned_seats ?? []).map((seat) => seat.label).join(", ") : booking.seats}
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-[#5c6488]"><MapPin className="size-4" /> Address</dt>
              <dd className="mt-1 font-semibold">{booking.space?.location ? `${booking.space.location.address}, ${booking.space.location.city}` : booking.location_name}</dd>
            </div>
          </dl>

          {(booking.addons ?? []).length > 0 && (
            <p className="text-sm text-[#5c6488]">
              Extras: {(booking.addons ?? []).map((addon) => `${addon.name}${addon.quantity > 1 ? ` × ${addon.quantity}` : ""}`).join(", ")}
            </p>
          )}
        </div>

        {/* Tear line between the details and the stub, like a ticket. */}
        <div aria-hidden className="relative h-6">
          <span className="absolute -left-3 top-0 size-6 rounded-full border border-border bg-background print:hidden" />
          <span className="absolute inset-x-6 top-1/2 border-t-2 border-dashed border-[#dfe2ee]" />
          <span className="absolute -right-3 top-0 size-6 rounded-full border border-border bg-background print:hidden" />
        </div>

        <div className="px-6 pb-6 pt-3 text-center">
          <BookingCountdownChip booking={booking} className="mb-3 print:hidden" />
          <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-[#5c6488]">
            <ScanLine className="size-4 text-[#f05a28]" /> Show this at the front desk
          </p>
          <CheckInQr code={booking.check_in_code} className="mx-auto mt-4 size-44 [&>svg]:size-full" />
          <p className="mt-4 text-xs text-[#5c6488]">Or give this code</p>
          <p className="mt-1 font-mono text-4xl font-bold tracking-[0.25em]">{booking.check_in_code}</p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-[#5c6488]">
            <span>Booking {booking.reference}</span>
            <span>{booking.paid_via === "pass" ? "Paid with pass credits" : (booking.invoice?.total ?? booking.total) > 0 ? `Paid ${formatNaira(booking.invoice?.total ?? booking.total)}` : "No charge"}</span>
            {booking.checked_in_at && <span className="font-semibold text-[#12805c]">Checked in</span>}
          </div>
        </div>
      </article>

      {booking.cancellation_policy.length > 0 && <p className="mt-4 text-center text-xs text-muted print:text-[#5c6488]">{booking.cancellation_policy.join(". ")}.</p>}
    </div>
  );
}
