import { MoveSeats } from "@/components/admin/bookings/move-seats";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { BookingAdminActions } from "@/components/admin/bookings/booking-admin-actions";
import { PaymentStatusBadge } from "@/components/billing/status-badges";
import { BookingStatusBadge } from "@/components/booking/booking-parts";
import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { ApiError, api } from "@/lib/api";
import { formatWhen } from "@/lib/booking-format";
import { can, requireStaff } from "@/lib/session";
import type { Booking } from "@/lib/types";
import { formatDateTime, formatNaira } from "@/lib/utils";

export const metadata: Metadata = { title: "Booking" };

export default function AdminBookingPage({ params }: PageProps<"/admin/bookings/[reference]">) {
  return (
    <>
      <Link href="/admin/bookings" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Bookings
      </Link>
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        {params.then(({ reference }) => (
          <Detail reference={reference} />
        ))}
      </Suspense>
    </>
  );
}

async function Detail({ reference }: { reference: string }) {
  const staff = await requireStaff();
  if (!can(staff, "bookings.manage") && !can(staff, "bookings.checkin")) redirect("/admin?denied=1");
  let booking: Booking;
  try {
    ({ data: booking } = await api<{ data: Booking }>(`/admin/bookings/${encodeURIComponent(reference)}`));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const rows: [string, ReactNode][] = [
    ["When", formatWhen(booking)],
    ["People", booking.seats],
    ...((booking.assigned_seats ?? []).length > 0
      ? [[booking.seats === 1 ? "Seat" : "Seats", <MoveSeats key="seats" booking={booking} canMove={can(staff, "bookings.manage") && booking.can_cancel} />] as [string, ReactNode]]
      : []),
    ["Length", booking.rate_unit === "hour" ? `${booking.quantity} hour(s)` : `${booking.quantity} ${booking.rate_unit}(s)`],
    ["Check-in code", booking.check_in_code ? <span className="font-mono font-semibold tracking-widest">{booking.check_in_code}</span> : "Issued once paid"],
    ["Checked in", booking.checked_in_at ? `${formatDateTime(booking.checked_in_at)}${booking.checked_in_by ? ` by ${booking.checked_in_by}` : ""}` : "Not yet"],
    ["Paid with", booking.paid_via ? { online: "Online payment", bank_transfer: "Bank transfer", pass: "Pass credits", free: "No charge", coupon: "Discount code (nothing to pay)" }[booking.paid_via] : "Not paid yet"],
    ["Notes", booking.notes ?? "None"],
  ];

  return (
    <>
      <PageHeader title={`${booking.space_name} · ${booking.customer?.name ?? "Customer"}`} description={<span className="flex flex-wrap items-center gap-2"><span className="font-mono">{booking.reference}</span><BookingStatusBadge booking={booking} /></span>} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Booking" />
            <dl className="divide-y divide-border">
              {rows.map(([label, value]) => (
                <div key={label} className="grid grid-cols-[140px_1fr] gap-4 px-5 py-3 text-sm sm:px-6">
                  <dt className="text-muted">{label}</dt>
                  <dd className="text-foreground">{value}</dd>
                </div>
              ))}
              {booking.cancelled_at && (
                <div className="grid grid-cols-[140px_1fr] gap-4 px-5 py-3 text-sm sm:px-6">
                  <dt className="text-muted">Cancelled</dt>
                  <dd className="text-foreground">
                    {formatDateTime(booking.cancelled_at)}: {booking.cancel_reason}
                    {booking.refund_amount > 0 && <span className="block text-success">Refund {formatNaira(booking.refund_amount)}</span>}
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Payment" description={booking.invoice ? `Invoice ${booking.invoice.number}` : "No invoice"} />
            <div className="space-y-2 p-5 text-sm sm:p-6">
              <div className="flex justify-between"><span className="text-muted">Space</span><span>{formatNaira(booking.subtotal)}</span></div>
              {(booking.addons ?? []).map((addon) => (
                <div key={addon.name} className="flex justify-between"><span className="text-muted">{addon.name}{addon.quantity > 1 ? ` × ${addon.quantity}` : ""}</span><span>{formatNaira(addon.total)}</span></div>
              ))}
              {booking.discount > 0 && <div className="flex justify-between text-success"><span>{booking.discount_label}</span><span>-{formatNaira(booking.discount)}</span></div>}
              <div className="flex justify-between border-t border-border pt-2 font-semibold"><span>Total</span><span>{formatNaira(booking.total)}</span></div>
              {booking.invoice?.coupon_code && (
                <>
                  <div className="flex justify-between text-success">
                    <span>Code <span className="font-mono font-semibold">{booking.invoice.coupon_code}</span></span>
                    <span>-{formatNaira(booking.invoice.coupon_discount)}</span>
                  </div>
                  <div className="flex justify-between font-semibold"><span>Customer pays</span><span>{formatNaira(booking.invoice.total)}</span></div>
                </>
              )}
              {(booking.invoice?.payments ?? []).map((payment) => (
                <div key={payment.reference} className="flex items-center justify-between gap-3 rounded-lg bg-surface-muted px-3 py-2">
                  <span className="text-muted">{payment.gateway_label} · {formatNaira(payment.amount)}</span>
                  <PaymentStatusBadge payment={payment} />
                </div>
              ))}
              {booking.invoice?.has_pending_transfer && (
                <Link href="/admin/finance/transfers" className="block font-semibold text-brand-600 hover:underline">
                  A bank transfer is waiting for review in Finance
                </Link>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Customer" />
            <div className="space-y-1 p-5 text-sm sm:p-6">
              <p className="font-semibold text-foreground">
                {booking.customer?.name} {booking.customer?.is_guest && <span className="text-xs font-normal text-muted">(guest, no account yet)</span>}
              </p>
              <p className="text-muted">{booking.customer?.email}</p>
              {booking.customer?.phone && <p className="text-muted">{booking.customer.phone}</p>}
            </div>
          </Card>
          <BookingAdminActions key={`${booking.status}-${booking.refund_amount}`} booking={booking} canManage={can(staff, "bookings.manage")} />
        </div>
      </div>
    </>
  );
}
