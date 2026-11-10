import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, CircleCheck, Clock, FileText, Receipt } from "lucide-react";
import { InvoiceDocument } from "@/components/billing/invoice-document";
import { PayPanel } from "@/components/billing/pay-panel";
import { PaymentStatusBadge } from "@/components/billing/status-badges";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { ApiError, api } from "@/lib/api";
import { requireCustomer } from "@/lib/session";
import type { Invoice, PaymentOptions } from "@/lib/types";
import { formatDateTime, formatNaira } from "@/lib/utils";

export default function CustomerInvoicePage({ params }: PageProps<"/dashboard/billing/invoices/[id]">) {
  return (
    <>
      <Link href="/dashboard/billing" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Billing
      </Link>
      <Suspense fallback={<Skeleton className="h-[520px] rounded-2xl" />}>
        {params.then(({ id }) => (
          <InvoiceView id={id} />
        ))}
      </Suspense>
    </>
  );
}

async function InvoiceView({ id }: { id: string }) {
  await requireCustomer();
  let invoice: Invoice;
  try {
    ({ data: invoice } = await api<{ data: Invoice }>(`/billing/invoices/${Number(id) || 0}`));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const options = invoice.is_payable && !invoice.has_pending_transfer ? await api<PaymentOptions>("/billing/options") : null;
  const pendingTransfer = invoice.payments?.find((payment) => payment.status === "awaiting_review");
  const rejected = invoice.payments?.find((payment) => payment.status === "rejected");

  return (
    <>
      <title>{`${invoice.number} | Reenite`}</title>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
        <div className="space-y-6">
          <InvoiceDocument invoice={invoice} />

          {invoice.payments && invoice.payments.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader title="Payment attempts" />
              <ul className="divide-y divide-border">
                {invoice.payments.map((payment) => (
                  <li key={payment.reference} className="flex flex-wrap items-center gap-3 px-5 py-4">
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-semibold text-foreground">
                        {formatNaira(payment.amount)} via {payment.gateway_label}
                      </p>
                      <p className="text-xs text-muted">
                        {formatDateTime(payment.created_at)} · <span className="font-mono">{payment.reference}</span>
                      </p>
                      {payment.status === "rejected" && payment.review_note && <p className="mt-1 text-xs text-danger">{payment.review_note}</p>}
                      {payment.status === "failed" && payment.failure_reason && <p className="mt-1 text-xs text-muted">{payment.failure_reason}</p>}
                    </div>
                    <PaymentStatusBadge payment={payment} />
                    {payment.has_proof && (
                      <a href={`/files/payments/${payment.reference}/proof`} target="_blank" rel="noreferrer" className="text-sm font-semibold text-brand-600 hover:underline">
                        <FileText className="mr-1 inline size-4" />
                        Proof
                      </a>
                    )}
                    {payment.receipt_number && (
                      <ButtonLink href={`/dashboard/billing/receipts/${payment.reference}`} variant="outline" size="sm">
                        <Receipt className="size-4" /> Receipt
                      </ButtonLink>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-4 xl:sticky xl:top-24">
          {invoice.status === "paid" && (
            <Alert tone="success" icon={CircleCheck} title="Paid in full">
              {invoice.total === 0 && invoice.coupon_code
                ? `Covered in full by the code ${invoice.coupon_code}. There's nothing to pay.`
                : "Thank you! Your receipt is listed under payment attempts."}
            </Alert>
          )}
          {invoice.status === "void" && (
            <Alert tone="info" icon={FileText} title="This invoice was cancelled">
              There&apos;s nothing to pay.
            </Alert>
          )}
          {pendingTransfer && (
            <Alert tone="warning" icon={Clock} title="We're checking your transfer">
              Thanks for sending proof of your {formatNaira(pendingTransfer.amount)} transfer. We&apos;ll email you as soon as Finance confirms it, usually within one working day.
            </Alert>
          )}
          {rejected && invoice.is_payable && !pendingTransfer && (
            <Alert tone="danger" icon={FileText} title="Your last transfer couldn't be confirmed">
              {rejected.review_note}
            </Alert>
          )}
          {options && <PayPanel invoice={invoice} options={options} />}
        </div>
      </div>
    </>
  );
}
