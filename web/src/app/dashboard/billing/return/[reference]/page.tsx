import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CircleCheck, CircleX, Clock } from "lucide-react";
import { AutoRefresh } from "@/components/billing/auto-refresh";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DotLoader } from "@/components/ui/loader";
import { ApiError, api } from "@/lib/api";
import { requireCustomer } from "@/lib/session";
import type { Payment } from "@/lib/types";
import { formatNaira } from "@/lib/utils";

export const metadata: Metadata = { title: "Payment status" };

/**
 * Gateways send customers back here. The API re-checks the payment with the gateway itself,
 * so nothing in the return URL (which a customer could edit) is trusted.
 */
export default function PaymentReturnPage({ params }: PageProps<"/dashboard/billing/return/[reference]">) {
  return (
    <div className="mx-auto max-w-lg py-6">
      <Suspense
        fallback={
          <Card className="flex flex-col items-center gap-4 p-10 text-center">
            <DotLoader className="scale-150" />
            <p className="text-muted">Confirming your payment…</p>
          </Card>
        }
      >
        {params.then(({ reference }) => (
          <Outcome reference={reference} />
        ))}
      </Suspense>
    </div>
  );
}

async function Outcome({ reference }: { reference: string }) {
  await requireCustomer();
  let result: { data: Payment; message: string | null };
  try {
    result = await api<{ data: Payment; message: string | null }>(`/billing/payments/${encodeURIComponent(reference)}/verify`, { method: "POST" });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const payment = result.data;
  const invoiceHref = `/dashboard/billing/invoices/${payment.invoice_id}`;

  if (payment.status === "success" || payment.status === "partially_refunded" || payment.status === "refunded") {
    return (
      <Card className="p-8 text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-success-soft text-success">
          <CircleCheck className="size-8" />
        </span>
        <h1 className="mt-6 text-3xl font-extrabold text-foreground">Payment received</h1>
        <p className="mt-2 text-muted">
          {formatNaira(payment.amount)} for {payment.invoice?.number} was paid via {payment.gateway_label}. We&apos;ve emailed you a receipt.
        </p>
        <p className="mt-4 font-mono text-sm text-muted">Receipt {payment.receipt_number}</p>
        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <ButtonLink href={`/dashboard/billing/receipts/${payment.reference}`}>View receipt</ButtonLink>
          <ButtonLink href="/dashboard" variant="outline">
            Back to dashboard
          </ButtonLink>
        </div>
      </Card>
    );
  }

  if (payment.status === "pending") {
    return (
      <Card className="p-8 text-center">
        <AutoRefresh />
        <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-info-soft text-info">
          <Clock className="size-8" />
        </span>
        <h1 className="mt-6 text-3xl font-extrabold text-foreground">Confirming your payment</h1>
        <p className="mt-2 text-muted">
          {result.message ?? `${payment.gateway_label} hasn't confirmed this payment yet. This page checks again automatically.`}
        </p>
        <p className="mt-2 text-sm text-muted">If you were charged, don&apos;t pay again. We&apos;ll confirm it as soon as {payment.gateway_label} does.</p>
        <ButtonLink href={invoiceHref} variant="outline" className="mt-8">
          Back to invoice
        </ButtonLink>
      </Card>
    );
  }

  return (
    <Card className="p-8 text-center">
      <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-danger-soft text-danger">
        <CircleX className="size-8" />
      </span>
      <h1 className="mt-6 text-3xl font-extrabold text-foreground">Payment not completed</h1>
      <p className="mt-2 text-muted">{payment.failure_reason ?? "The payment was cancelled or declined. You haven't been charged."}</p>
      <ButtonLink href={invoiceHref} className="mt-8">
        Try again
      </ButtonLink>
    </Card>
  );
}
