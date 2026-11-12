import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarCheck, CalendarX, CircleCheck, Clock, Hourglass, Landmark, MapPin, Ticket, Users } from "lucide-react";
import { PayPanel } from "@/components/billing/pay-panel";
import { HoldCountdown } from "@/components/booking/hold-countdown";
import { BookingTracker } from "@/components/booking/booking-tracker";
import { CancelBooking } from "@/components/booking/cancel-booking";
import { Stepper } from "@/components/booking/stepper";
import { ButtonLink } from "@/components/ui/button";
import { ApiError, api } from "@/lib/api";
import { applyBookingCoupon, payBooking, removeBookingCoupon, submitBookingTransfer } from "@/lib/actions/bookings";
import { formatWhen } from "@/lib/booking-format";
import { getOptionalUser } from "@/lib/session";
import type { Booking, PaymentOptions } from "@/lib/types";
import { formatNaira } from "@/lib/utils";

/**
 * One booking, for its owner or anyone holding the private link we emailed (guests).
 * Shows what to do next: pay, wait for approval, or show the check-in code at the desk.
 * `inDashboard` is the signed-in customer's view inside their dashboard.
 */
export async function BookingView({ reference, token, paid, inDashboard = false }: { reference: string; token: string; paid: boolean; inDashboard?: boolean }) {
  let booking: Booking;
  try {
    ({ data: booking } = await api<{ data: Booking }>(`/bookings/${encodeURIComponent(reference)}?${new URLSearchParams({ token })}`));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const user = await getOptionalUser();
  const holdActive = booking.hold_active;
  const transferPending = booking.invoice?.has_pending_transfer === true;
  const options = booking.status === "held" && holdActive && !transferPending ? await api<PaymentOptions>("/bookings/payment-options", { anonymous: true }) : null;

  // Continues the booking steps: paying is the last one, and a confirmed booking has done them all.
  const stepperAt = booking.status === "held" && (holdActive || transferPending) ? 3 : ["confirmed", "checked_in"].includes(booking.status) ? 4 : null;

  const showCode = (booking.status === "confirmed" || booking.status === "checked_in") && Boolean(booking.check_in_code);
  const passHref = inDashboard ? `/dashboard/workspace/${booking.reference}/pass` : `/bookings/${booking.reference}/pass?${new URLSearchParams({ token })}`;
  const headline = headlineFor(booking, holdActive, transferPending, paid, `${inDashboard ? "/dashboard/workspace/book" : "/book"}/${booking.space?.slug ?? ""}`);
  const showCancel = booking.can_cancel && booking.status !== "held";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {stepperAt === 3 && <Stepper current={stepperAt} />}

      {/* Countdown to the start, then live time left, then "book again". */}
      <BookingTracker booking={booking} bookHref={`${inDashboard ? "/dashboard/workspace/book" : "/book"}/${booking.space?.slug ?? ""}`} />

      {/* One ticket: what happened, what was booked, and the code to show at the desk. */}
      <article className="overflow-hidden rounded-2xl border border-border bg-surface">
        <header className="flex items-start gap-4 p-6 sm:p-8">
          <span className={`flex size-11 shrink-0 items-center justify-center rounded-full ${headline.tone}`}>
            <headline.icon className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{headline.title}</h1>
            <div className="mt-1 text-muted">{headline.body}</div>
          </div>
        </header>

        <div className={`grid border-t border-border ${showCode ? "sm:grid-cols-[minmax(0,1fr)_15rem]" : ""}`}>
          <div className="p-6 sm:p-8">
            <p className="text-lg font-bold text-foreground">{booking.space_name}</p>
            <p className="mt-0.5 font-mono text-xs text-muted">{booking.reference}</p>
            <dl className="mt-5 space-y-2.5 text-[15px]">
              <Detail icon={Clock} label="When">
                {formatWhen(booking)}
              </Detail>
              <Detail icon={Users} label="People">
                {booking.seats} {booking.seats === 1 ? "person" : "people"}
                {(booking.assigned_seats ?? []).length > 0 && (
                  <span className="font-semibold"> · {(booking.assigned_seats ?? []).map((seat) => seat.label).join(", ")}</span>
                )}
              </Detail>
              <Detail icon={MapPin} label="Where">
                {booking.location_name}
                {booking.space?.location?.address ? `, ${booking.space.location.address}` : ""}
              </Detail>
              {(booking.addons ?? []).map((addon) => (
                <Detail key={addon.name} icon={CalendarCheck} label="Extra">
                  {addon.name}
                  {addon.quantity > 1 ? ` × ${addon.quantity}` : ""} · {formatNaira(addon.total)}
                </Detail>
              ))}
            </dl>
            <div className="mt-6 flex items-baseline justify-between gap-4 border-t border-border pt-4">
              <span className="text-sm text-muted">
                {booking.discount > 0 ? `Total after ${booking.discount_label} (-${formatNaira(booking.discount)})` : "Total"}
              </span>
              <span className="text-xl font-bold text-foreground">{formatNaira(booking.total)}</span>
            </div>
            {booking.invoice?.coupon_code && (
              <div className="mt-2 flex items-baseline justify-between gap-4 text-sm">
                <span className="text-muted">
                  Code <span className="font-mono font-semibold text-foreground">{booking.invoice.coupon_code}</span> (-{formatNaira(booking.invoice.coupon_discount)})
                </span>
                <span className="font-semibold text-foreground">You pay {formatNaira(booking.invoice.total)}</span>
              </div>
            )}
            {booking.refund_amount > 0 && <p className="mt-2 text-sm text-success">Refund: {formatNaira(booking.refund_amount)}</p>}
          </div>

          {showCode && (
            <div className="flex flex-col items-center justify-center gap-1 border-t border-dashed border-border bg-surface-muted/60 p-6 text-center sm:border-l sm:border-t-0 sm:p-8">
              <p className="text-xs font-semibold text-muted">Check-in code</p>
              <p className="font-mono text-3xl font-bold tracking-[0.2em] text-foreground">{booking.check_in_code}</p>
              <p className="text-xs text-muted">{booking.checked_in_at ? "Checked in" : "Show this at the front desk"}</p>
              <Link href={passHref} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline">
                <Ticket className="size-4" /> Booking pass
              </Link>
            </div>
          )}
        </div>

        {(booking.cancellation_policy.length > 0 || showCancel) && (
          <footer className="flex flex-col gap-3 border-t border-border px-6 py-4 text-sm sm:flex-row sm:items-start sm:justify-between sm:px-8">
            <p className="text-muted">{booking.cancellation_policy.map((line) => line.replace(/\.?$/, ".")).join(" ")}</p>
            {showCancel && <CancelBooking booking={booking} token={token} />}
          </footer>
        )}
      </article>

      {options && booking.invoice && (
        <PayPanel
          invoice={booking.invoice}
          options={options}
          title="Pay to confirm your booking"
          pay={payBooking.bind(null, booking.reference, token)}
          transfer={submitBookingTransfer.bind(null, booking.reference, token)}
          coupon={{ apply: applyBookingCoupon.bind(null, booking.reference, token), remove: removeBookingCoupon.bind(null, booking.reference, token) }}
        />
      )}

      {!user && !inDashboard && booking.status !== "expired" && (
        <p className="text-center text-sm text-muted">
          Want to keep track of your bookings?{" "}
          <Link href="/register" className="font-semibold text-brand-600 hover:underline">
            Create a free account
          </Link>{" "}
          with the email you booked with.
        </p>
      )}
    </div>
  );
}

function Detail({ icon: Icon, label, children }: { icon: typeof Clock; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted" />
      <div>
        <dt className="sr-only">{label}</dt>
        <dd className="text-foreground">{children}</dd>
      </div>
    </div>
  );
}

type Headline = { icon: typeof Clock; tone: string; title: string; body: ReactNode };

function headlineFor(booking: Booking, holdActive: boolean, transferPending: boolean, paid: boolean, bookAgain: string): Headline {
  const ended: Headline = {
    icon: CalendarX,
    tone: "bg-navy-50 text-foreground",
    title: "This hold has ended",
    body: (
      <ButtonLink href={bookAgain} size="sm" className="mt-2">
        Book again
      </ButtonLink>
    ),
  };

  switch (booking.status) {
    case "confirmed":
      return { icon: CircleCheck, tone: "bg-success-soft text-success", title: paid ? "Payment received. You're booked!" : "You're booked!", body: "We've emailed your confirmation. See you soon." };
    case "checked_in":
      return { icon: CircleCheck, tone: "bg-success-soft text-success", title: "You're checked in", body: "Enjoy your day at Reenite." };
    case "completed":
      return { icon: CalendarCheck, tone: "bg-navy-50 text-foreground", title: "Booking completed", body: "Thanks for working with us. Come back soon." };
    case "pending_approval":
      return { icon: Hourglass, tone: "bg-info-soft text-info", title: "Request received", body: "Our team reviews bookings for this space. We'll email you within one working day, and you'll pay once it's approved." };
    case "cancelled":
      return { icon: CalendarX, tone: "bg-danger-soft text-danger", title: "Booking cancelled", body: booking.cancel_reason ?? "This booking was cancelled." };
    case "expired":
      return ended;
    default:
      if (transferPending) {
        return { icon: Landmark, tone: "bg-info-soft text-info", title: "We're checking your transfer", body: "Your space is held while our finance team confirms it, usually within one working day." };
      }
      if (!holdActive) {
        return ended;
      }
      return {
        icon: Clock,
        tone: "bg-warning-soft text-warning",
        title: "Almost there",
        body: (
          <>
            We&apos;re holding this space for you for <HoldCountdown until={booking.hold_expires_at!} />. Pay below to confirm it.
          </>
        ),
      };
  }
}
