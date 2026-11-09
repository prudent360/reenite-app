import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, FileText } from "lucide-react";
import { RefundForm } from "@/components/admin/finance/refund-form";
import { TransferReview } from "@/components/admin/finance/transfer-review";
import { PaymentStatusBadge } from "@/components/billing/status-badges";
import { Badge, Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { ApiError, api } from "@/lib/api";
import { can, requireStaff } from "@/lib/session";
import type { Payment } from "@/lib/types";
import { formatDate, formatDateTime, formatNaira } from "@/lib/utils";

export default function AdminPaymentPage({ params }: PageProps<"/admin/finance/payments/[reference]">) {
  return (
    <>
      <Link href="/admin/finance" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Finance
      </Link>
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        {params.then(({ reference }) => (
          <PaymentDetail reference={reference} />
        ))}
      </Suspense>
    </>
  );
}

async function PaymentDetail({ reference }: { reference: string }) {
  const user = await requireStaff("payments.view");
  let payment: Payment;
  try {
    ({ data: payment } = await api<{ data: Payment }>(`/admin/finance/payments/${encodeURIComponent(reference)}`));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const rows: [string, React.ReactNode][] = [
    ["Reference", <span key="r" className="font-mono">{payment.reference}</span>],
    ["Receipt", payment.receipt_number ?? "—"],
    ["Invoice", payment.invoice ? <Link key="i" href={`/admin/finance/invoices/${payment.invoice.id}`} className="font-semibold text-brand-600 hover:underline">{payment.invoice.number}</Link> : "—"],
    ["Customer", payment.customer ? `${payment.customer.name} · ${payment.customer.email}` : "—"],
    ["Method", <span key="m">{payment.gateway_label}{payment.channel && payment.channel !== "bank_transfer" ? ` (${payment.channel})` : ""} {payment.mode === "test" && payment.gateway !== "bank_transfer" && <Badge tone="warning">Test mode</Badge>}</span>],
    ["Created", formatDateTime(payment.created_at)],
    ["Paid", formatDateTime(payment.paid_at)],
  ];
  if (payment.gateway === "bank_transfer") {
    rows.push(["Sender name", payment.sender_name ?? "—"], ["Transfer date", formatDate(payment.transferred_on)]);
  }
  if (payment.reviewed_by) rows.push(["Reviewed by", `${payment.reviewed_by} · ${formatDateTime(payment.reviewed_at)}`]);
  if (payment.review_note) rows.push(["Review note", payment.review_note]);
  if (payment.failure_reason) rows.push(["Failure", payment.failure_reason]);

  return (
    <>
      <title>{`${payment.reference} | Reenite Admin`}</title>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-extrabold text-foreground">{formatNaira(payment.amount)}</h1>
        <PaymentStatusBadge payment={payment} />
      </div>

      {payment.status === "awaiting_review" && can(user, "payments.verify") && (
        <div className="mb-6">
          <TransferReview payment={payment} />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Details" />
            <dl className="divide-y divide-border">
              {rows.map(([label, value]) => (
                <div key={label} className="grid gap-1 px-5 py-3 text-sm sm:grid-cols-[160px_1fr]">
                  <dt className="text-muted">{label}</dt>
                  <dd className="text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
            {payment.has_proof && (
              <div className="border-t border-border px-5 py-4">
                <a href={`/files/admin/payments/${payment.reference}/proof`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:underline">
                  <FileText className="size-4" /> View transfer proof ({payment.proof_name})
                </a>
              </div>
            )}
          </Card>

          {payment.refunds && payment.refunds.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader title="Refunds" description={`${formatNaira(payment.amount_refunded)} refunded in total`} />
              <ul className="divide-y divide-border">
                {payment.refunds.map((refund) => (
                  <li key={refund.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                    <div>
                      <p className="font-semibold text-foreground">
                        {formatNaira(refund.amount)} <span className="font-normal text-muted">· {refund.method === "gateway" ? `via gateway${refund.gateway_reference ? ` (${refund.gateway_reference})` : ""}` : "manual"}</span>
                      </p>
                      <p className="text-muted">{refund.reason}</p>
                    </div>
                    <span className="text-xs text-muted">{formatDateTime(refund.created_at)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        {payment.refundable > 0 && can(user, "refunds.process") && <RefundForm payment={payment} />}
      </div>
    </>
  );
}
