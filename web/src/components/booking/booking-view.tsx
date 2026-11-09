import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { CalendarCheck, CalendarX, CircleCheck, Clock, Hourglass, Landmark, MapPin, QrCode, Ticket, Users } from "lucide-react";
import { PayPanel } from "@/components/billing/pay-panel";
import { BookingStatusBadge } from "@/components/booking/booking-parts";
import { HoldCountdown } from "@/components/booking/hold-countdown";
import { CancelBooking } from "@/components/booking/cancel-booking";
import { Stepper } from "@/components/booking/stepper";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ApiError, api } from "@/lib/api";
import { payBooking, submitBookingTransfer } from "@/lib/actions/bookings";
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

  return (
    <div className="space-y-6">
      {stepperAt !== null && <Stepper current={stepperAt} />}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Headline booking={booking} holdActive={holdActive} transferPending={transferPending} paid={paid} bookAgain={`${inDashboard ? "/dashboard/workspace/book" : "/book"}/${booking.space?.slug ?? ""}`} />

          {(booking.status === "confirmed" || booking.status === "checked_in") && booking.check_in_code && (
            <Card className="p-6 text-center">
              <QrCode className="mx-auto size-8 text-brand-500" />
              <p className="mt-3 text-sm font-semibold text-muted">Show this code at the front desk</p>
              <p className="mt-2 font-mono text-4xl font-bold tracking-[0.3em] text-foreground">{booking.check_in_code}</p>
              {booking.checked_in_at && <p className="mt-3 text-sm text-success">Checked in. Enjoy your day at Reenite.</p>}
              <ButtonLink
                href={inDashboard ? `/dashboard/workspace/${booking.reference}/pass` : `/bookings/${booking.reference}/pass?${new URLSearchParams({ token })}`}
                variant="outline"
                className="mt-5"
              >
                <Ticket className="size-4" /> View booking pass
              </ButtonLink>
            </Card>
          )}

          {options && booking.invoice && (
            <PayPanel
              invoice={booking.invoice}
              options={options}
              title="Pay to confirm your booking"
              pay={payBooking.bind(null, booking.reference, token)}
              transfer={submitBookingTransfer.bind(null, booking.reference, token)}
            />
          )}

          {booking.can_cancel && booking.status !== "held" && <CancelBooking booking={booking} token={token} />}

          {!user && !inDashboard && booking.status !== "expired" && (
            <Card className="p-5 text-sm">
              <p className="font-semibold text-foreground">Keep track of your bookings</p>
              <p className="mt-1 text-muted">Create a free account with the email you booked with and this booking will be waiting for you.</p>
              <ButtonLink href="/register" variant="outline" size="sm" className="mt-3">
                Create an account
              </ButtonLink>
            </Card>
          )}
        </div>

        <Card className="lg:sticky lg:top-24">
          <CardHeader title={booking.space_name} description={booking.reference} />
          <dl className="space-y-3 p-5 text-sm sm:p-6">
            <Detail icon={Clock} label="When">
              {formatWhen(booking)}
            </Detail>
            <Detail icon={Users} label="People">
              {booking.seats} {booking.seats === 1 ? "person" : "people"}
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
            {booking.discount > 0 && (
              <Detail icon={Ticket} label="Discount">
                {booking.discount_label}: -{formatNaira(booking.discount)}
              </Detail>
            )}
            <div className="flex items-baseline justify-between border-t border-border pt-3">
              <dt className="font-semibold text-foreground">Total</dt>
              <dd className="text-xl font-bold text-foreground">{formatNaira(booking.total)}</dd>
            </div>
            {booking.refund_amount > 0 && <p className="text-success">Refund: {formatNaira(booking.refund_amount)}</p>}
            {booking.cancellation_policy.length > 0 && (
              <div className="rounded-xl bg-surface-muted p-3 text-xs leading-relaxed text-muted">
                {booking.cancellation_policy.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            )}
          </dl>
        </Card>
      </div>
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

function Headline({ booking, holdActive, transferPending, paid, bookAgain }: { booking: Booking; holdActive: boolean; transferPending: boolean; paid: boolean; bookAgain: string }) {
  const shell = (icon: ReactNode, title: string, body: ReactNode) => (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        {icon}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            <BookingStatusBadge booking={booking} />
          </div>
          <div className="mt-1.5 text-muted">{body}</div>
        </div>
      </div>
    </Card>
  );
  const iconBox = (Icon: typeof Clock, tone: string) => (
    <span className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${tone}`}>
      <Icon className="size-6" />
    </span>
  );

  switch (booking.status) {
    case "confirmed":
      return shell(iconBox(CircleCheck, "bg-success-soft text-success"), paid ? "Payment received. You're booked!" : "You're booked!", "We've emailed your confirmation. See you soon.");
    case "checked_in":
      return shell(iconBox(CircleCheck, "bg-success-soft text-success"), "You're checked in", "Enjoy your day at Reenite.");
    case "completed":
      return shell(iconBox(CalendarCheck, "bg-navy-50 text-foreground"), "Booking completed", "Thanks for working with us. Come back soon.");
    case "pending_approval":
      return shell(iconBox(Hourglass, "bg-info-soft text-info"), "Request received", "Our team reviews bookings for this space. We'll email you within one working day, and you'll pay once it's approved.");
    case "cancelled":
      return shell(iconBox(CalendarX, "bg-danger-soft text-danger"), "Booking cancelled", booking.cancel_reason ?? "This booking was cancelled.");
    case "expired":
      return shell(iconBox(CalendarX, "bg-navy-50 text-foreground"), "This hold has ended", <ButtonLink href={bookAgain} size="sm" className="mt-2">Book again</ButtonLink>);
    default:
      if (transferPending) {
        return shell(iconBox(Landmark, "bg-info-soft text-info"), "We're checking your transfer", "Your space is held while our finance team confirms it, usually within one working day.");
      }
      if (!holdActive) {
        return shell(iconBox(CalendarX, "bg-navy-50 text-foreground"), "This hold has ended", <ButtonLink href={bookAgain} size="sm" className="mt-2">Book again</ButtonLink>);
      }
      return shell(
        iconBox(Clock, "bg-warning-soft text-warning"),
        "Almost there",
        <>
          We&apos;re holding this space for you for <HoldCountdown until={booking.hold_expires_at!} />. Pay below to confirm it.
        </>,
      );
  }
}
