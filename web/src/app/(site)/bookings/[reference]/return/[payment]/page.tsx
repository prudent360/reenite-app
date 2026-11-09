import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { CircleX, Clock } from "lucide-react";
import { AutoRefresh } from "@/components/billing/auto-refresh";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DotLoader } from "@/components/ui/loader";
import { ApiError, api } from "@/lib/api";
import { getOptionalUser } from "@/lib/session";
import type { Booking, Payment } from "@/lib/types";

export const metadata: Metadata = { title: "Payment status", robots: { index: false } };

/**
 * Gateways send people back here after paying for a booking. The API re-checks the payment with
 * the gateway itself, so nothing in this URL is trusted; a confirmed booking goes to its page.
 */
export default function BookingPaymentReturnPage({ params, searchParams }: PageProps<"/bookings/[reference]/return/[payment]">) {
  return (
    <section className="mx-auto max-w-lg px-4 py-12">
      <Suspense
        fallback={
          <Card className="flex flex-col items-center gap-4 p-10 text-center">
            <DotLoader className="scale-150" />
            <p className="text-muted">Confirming your payment…</p>
          </Card>
        }
      >
        {Promise.all([params, searchParams]).then(([{ reference, payment }, query]) => (
          <Outcome reference={reference} payment={payment} token={typeof query.token === "string" ? query.token : ""} />
        ))}
      </Suspense>
    </section>
  );
}

async function Outcome({ reference, payment, token }: { reference: string; payment: string; token: string }) {
  let result: { payment: Payment; booking: Booking; message: string | null };
  try {
    result = await api(`/bookings/${encodeURIComponent(reference)}/payments/${encodeURIComponent(payment)}/verify`, { method: "POST", body: { token } });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  // Signed-in customers go back to the booking in their dashboard; guests to their private page.
  const user = await getOptionalUser();
  const bookingUrl = user?.type === "customer" ? `/dashboard/workspace/${reference}?${new URLSearchParams({ token })}` : `/bookings/${reference}?${new URLSearchParams({ token })}`;

  if (["success", "partially_refunded", "refunded"].includes(result.payment.status)) {
    redirect(`${bookingUrl}&paid=1`);
  }

  if (result.payment.status === "pending") {
    return (
      <Card className="p-8 text-center">
        <AutoRefresh />
        <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-info-soft text-info">
          <Clock className="size-8" />
        </span>
        <h1 className="mt-6 text-3xl font-bold text-foreground">Confirming your payment</h1>
        <p className="mt-2 text-muted">{result.message ?? `${result.payment.gateway_label} hasn't confirmed this payment yet. This page checks again automatically.`}</p>
        <p className="mt-2 text-sm text-muted">If you were charged, don&apos;t pay again. Your booking is confirmed as soon as the payment is.</p>
        <ButtonLink href={bookingUrl} variant="outline" className="mt-8">
          Back to booking
        </ButtonLink>
      </Card>
    );
  }

  return (
    <Card className="p-8 text-center">
      <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-danger-soft text-danger">
        <CircleX className="size-8" />
      </span>
      <h1 className="mt-6 text-3xl font-bold text-foreground">Payment not completed</h1>
      <p className="mt-2 text-muted">{result.payment.failure_reason ?? "The payment was cancelled or declined. You haven't been charged."}</p>
      <ButtonLink href={bookingUrl} className="mt-8">
        Try again
      </ButtonLink>
    </Card>
  );
}
