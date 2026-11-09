import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, PartyPopper, UserRound } from "lucide-react";
import { VoidInvoiceButton } from "@/components/admin/finance/void-invoice-button";
import { InvoiceDocument } from "@/components/billing/invoice-document";
import { PaymentStatusBadge } from "@/components/billing/status-badges";
import { Alert, Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { ApiError, api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import type { Invoice } from "@/lib/types";
import { formatDateTime, formatNaira } from "@/lib/utils";

export default function AdminInvoicePage({ params, searchParams }: PageProps<"/admin/finance/invoices/[id]">) {
  return (
    <>
      <Link href="/admin/finance/invoices" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Invoices
      </Link>
      <Suspense fallback={<Skeleton className="h-[520px] rounded-2xl" />}>
        <InvoiceDetail params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function InvoiceDetail({ params, searchParams }: Pick<PageProps<"/admin/finance/invoices/[id]">, "params" | "searchParams">) {
  await requireStaff("invoices.manage");
  const [{ id }, query] = await Promise.all([params, searchParams]);
  let invoice: Invoice;
  try {
    ({ data: invoice } = await api<{ data: Invoice }>(`/admin/finance/invoices/${Number(id) || 0}`));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  return (
    <>
      <title>{`${invoice.number} | Reenite Admin`}</title>
      {query.created && (
        <Alert tone="success" icon={PartyPopper} title="Invoice created" className="mb-6">
          {invoice.customer?.name} can pay it from their Billing page.
        </Alert>
      )}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <InvoiceDocument invoice={invoice} />
        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-navy-900 text-white dark:bg-navy-700">
                <UserRound className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{invoice.customer?.name}</p>
                <p className="truncate text-sm text-muted">{invoice.customer?.email}</p>
              </div>
            </div>
            {invoice.created_by && <p className="mt-3 text-xs text-muted">Raised by {invoice.created_by}</p>}
            {invoice.status === "unpaid" && invoice.amount_paid === 0 && (
              <div className="mt-4 border-t border-border pt-4">
                <VoidInvoiceButton invoiceId={invoice.id} number={invoice.number} />
              </div>
            )}
          </Card>
          <Card className="overflow-hidden">
            <CardHeader title="Payments" />
            {invoice.payments && invoice.payments.length > 0 ? (
              <ul className="divide-y divide-border">
                {invoice.payments.map((payment) => (
                  <li key={payment.reference}>
                    <Link href={`/admin/finance/payments/${payment.reference}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-muted/60">
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="font-semibold text-foreground">
                          {formatNaira(payment.amount)} · {payment.gateway_label}
                        </p>
                        <p className="text-xs text-muted">{formatDateTime(payment.created_at)}</p>
                      </div>
                      <PaymentStatusBadge payment={payment} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={UserRound} title="No payments yet" description="Payment attempts will show here." className="py-8" />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
