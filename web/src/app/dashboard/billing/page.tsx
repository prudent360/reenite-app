import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Receipt, ReceiptText, Wallet } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { InvoiceStatusBadge, PaymentStatusBadge } from "@/components/billing/status-badges";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireCustomer } from "@/lib/session";
import { SavedCards } from "@/components/billing/saved-cards";
import type { Invoice, Paginated, Payment, SavedCard } from "@/lib/types";
import { formatDate, formatNaira } from "@/lib/utils";

export const metadata: Metadata = { title: "Billing" };

export default function BillingPage() {
  return (
    <>
      <PageHeader title="Billing" description="Your invoices, payments and receipts." />
      <Suspense fallback={<Skeleton className="h-[480px] rounded-2xl" />}>
        <Billing />
      </Suspense>
    </>
  );
}

async function Billing() {
  await requireCustomer();
  const [{ data: invoices }, { data: payments }, { data: cards }] = await Promise.all([
    api<Paginated<Invoice>>("/billing/invoices"),
    api<Paginated<Payment>>("/billing/payments"),
    api<{ data: SavedCard[] }>("/billing/cards"),
  ]);
  const outstanding = invoices.filter((invoice) => invoice.status === "unpaid");

  return (
    <div className="space-y-6">
      {outstanding.length > 0 && (
        <section aria-label="Outstanding invoices" className="grid gap-4 md:grid-cols-2">
          {outstanding.map((invoice) => (
            <Card key={invoice.id} className="flex flex-col gap-4 border-brand-500/40 p-5 sm:flex-row sm:items-center">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Wallet className="size-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                  {invoice.number} <InvoiceStatusBadge invoice={invoice} />
                </p>
                <p className="text-sm text-muted">
                  <span className="font-display text-lg font-extrabold text-foreground">{formatNaira(invoice.balance)}</span>
                  {invoice.due_at && <> · due {formatDate(invoice.due_at)}</>}
                </p>
              </div>
              <ButtonLink href={`/dashboard/billing/invoices/${invoice.id}`}>
                {invoice.has_pending_transfer ? "View" : "Pay now"} <ArrowRight className="size-4" />
              </ButtonLink>
            </Card>
          ))}
        </section>
      )}

      <Card className="overflow-hidden">
        <CardHeader title="Invoices" />
        {invoices.length === 0 ? (
          <EmptyState icon={ReceiptText} title="No invoices yet" description="When you order a service or book a space, your invoice will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="bg-surface-muted text-xs font-semibold uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-3">Invoice</th>
                  <th className="px-5 py-3">Issued</th>
                  <th className="px-5 py-3">Due</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-surface-muted/50">
                    <td className="px-5 py-3.5">
                      <Link href={`/dashboard/billing/invoices/${invoice.id}`} className="font-semibold text-foreground hover:text-brand-600">
                        {invoice.number}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-muted">{formatDate(invoice.created_at)}</td>
                    <td className="px-5 py-3.5 text-muted">{formatDate(invoice.due_at)}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-foreground">{formatNaira(invoice.total)}</td>
                    <td className="px-5 py-3.5">
                      <InvoiceStatusBadge invoice={invoice} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <SavedCards cards={cards} />

      <Card className="overflow-hidden">
        <CardHeader title="Payments" description="Every payment attempt, with receipts for successful ones." />
        {payments.length === 0 ? (
          <EmptyState icon={Receipt} title="No payments yet" description="Payments you make will be listed here with their receipts." />
        ) : (
          <ul className="divide-y divide-border">
            {payments.map((payment) => (
              <li key={payment.reference} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">
                    {formatNaira(payment.amount)} <span className="font-normal text-muted">via {payment.gateway_label}</span>
                  </p>
                  <p className="text-xs text-muted">
                    {payment.invoice?.number} · {formatDate(payment.paid_at ?? payment.created_at)} · <span className="font-mono">{payment.reference}</span>
                  </p>
                </div>
                <PaymentStatusBadge payment={payment} />
                {payment.receipt_number && (
                  <ButtonLink href={`/dashboard/billing/receipts/${payment.reference}`} variant="outline" size="sm">
                    <Receipt className="size-4" /> Receipt
                  </ButtonLink>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
