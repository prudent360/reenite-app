import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus, ReceiptText, Search } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { InvoiceStatusBadge } from "@/components/billing/status-badges";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import type { Invoice, Paginated } from "@/lib/types";
import { formatDate, formatNaira } from "@/lib/utils";

export const metadata: Metadata = { title: "Invoices" };

export default function InvoicesPage({ searchParams }: PageProps<"/admin/finance/invoices">) {
  return (
    <>
      <PageHeader
        title="Invoices"
        description="Bills raised for customers. Service orders and bookings will add theirs here automatically."
        actions={
          <ButtonLink href="/admin/finance/invoices/new">
            <Plus className="size-4" /> New invoice
          </ButtonLink>
        }
      />
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <InvoiceTable searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function InvoiceTable({ searchParams }: { searchParams: PageProps<"/admin/finance/invoices">["searchParams"] }) {
  await requireStaff("invoices.manage");
  const params = await searchParams;
  const status = params.status === "unpaid" || params.status === "paid" || params.status === "void" ? params.status : "";
  const search = typeof params.q === "string" ? params.q : "";
  const query = new URLSearchParams();
  if (status) query.set("status", status);
  if (search) query.set("search", search);
  const { data: invoices } = await api<Paginated<Invoice>>(`/admin/finance/invoices?${query}`);

  return (
    <Card className="overflow-hidden">
      <form className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:p-5">
        <label className="relative flex-1">
          <span className="sr-only">Search invoices</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={search} placeholder="Invoice number or customer" className="h-10 w-full rounded-xl border border-border bg-surface pl-10 pr-3 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15" />
        </label>
        <select name="status" defaultValue={status} aria-label="Filter by status" className="h-10 rounded-xl border border-border bg-surface px-3 text-sm text-foreground">
          <option value="">Any status</option>
          <option value="unpaid">Unpaid</option>
          <option value="paid">Paid</option>
          <option value="void">Cancelled</option>
        </select>
        <button type="submit" className={buttonClasses({ variant: "navy", size: "sm", className: "h-10" })}>
          Filter
        </button>
      </form>
      {invoices.length === 0 ? (
        <EmptyState icon={ReceiptText} title={status || search ? "No invoices match" : "No invoices yet"} description="Raise an invoice to bill a customer." action={<ButtonLink href="/admin/finance/invoices/new">New invoice</ButtonLink>} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-surface-muted text-xs font-semibold uppercase tracking-wider text-muted">
              <tr>
                <th className="px-5 py-3">Invoice</th>
                <th className="px-5 py-3">Customer</th>
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
                    <Link href={`/admin/finance/invoices/${invoice.id}`} className="font-semibold text-foreground hover:text-brand-600">
                      {invoice.number}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-foreground">{invoice.customer?.name}</p>
                    <p className="text-xs text-muted">{invoice.customer?.email}</p>
                  </td>
                  <td className="px-5 py-3.5 text-muted">{formatDate(invoice.created_at)}</td>
                  <td className="px-5 py-3.5 text-muted">{formatDate(invoice.due_at)}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right font-semibold text-foreground">{formatNaira(invoice.total)}</td>
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
  );
}
