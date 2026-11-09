import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Landmark, ReceiptText, RotateCcw, Search, TrendingUp, Wallet } from "lucide-react";
import { BarChart } from "@/components/app/bar-chart";
import { Panel, StatTile, StatTilesSkeleton } from "@/components/app/dashboard-widgets";
import { PageHeader } from "@/components/app/page-header";
import { PaymentStatusBadge } from "@/components/billing/status-badges";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { can, requireStaff } from "@/lib/session";
import type { FinanceSummary, Paginated, Payment } from "@/lib/types";
import { formatDateTime, formatNaira } from "@/lib/utils";

export const metadata: Metadata = { title: "Finance" };

const monthYear = new Intl.DateTimeFormat("en-NG", { month: "long", year: "numeric", timeZone: "UTC" });

const statuses = [
  ["", "Any status"],
  ["success", "Paid"],
  ["awaiting_review", "Awaiting review"],
  ["pending", "Pending"],
  ["failed", "Failed"],
  ["abandoned", "Abandoned"],
  ["rejected", "Rejected"],
  ["partially_refunded", "Partly refunded"],
  ["refunded", "Refunded"],
] as const;

export default function FinancePage({ searchParams }: PageProps<"/admin/finance">) {
  return (
    <>
      <PageHeader
        title="Finance"
        description="Money in, transfers to confirm and refunds."
        actions={
          <ButtonLink href="/admin/finance/invoices/new">
            <ReceiptText className="size-4" /> New invoice
          </ButtonLink>
        }
      />
      <Suspense fallback={<FinanceSkeleton />}>
        <Finance searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Finance({ searchParams }: { searchParams: PageProps<"/admin/finance">["searchParams"] }) {
  const user = await requireStaff("payments.view");
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "";
  const search = typeof params.q === "string" ? params.q : "";
  const query = new URLSearchParams();
  if (status) query.set("status", status);
  if (search) query.set("search", search);

  const [summary, { data: payments }] = await Promise.all([
    api<FinanceSummary>("/admin/finance/summary"),
    api<Paginated<Payment>>(`/admin/finance/payments?${query}`),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={Wallet} tone="solid" value={formatNaira(summary.collected_30d)} label="Collected" hint="Last 30 days" />
        <StatTile icon={ReceiptText} tone="brand" value={formatNaira(summary.outstanding)} label="Outstanding" hint={`${summary.unpaid_invoices} unpaid invoices`} />
        <StatTile icon={Landmark} tone="info" value={summary.awaiting_review.toLocaleString()} label="Transfers to review" hint="Waiting for Finance" />
        <StatTile icon={RotateCcw} tone="navy" value={formatNaira(summary.refunded_30d)} label="Refunded" hint="Last 30 days" />
      </div>

      {summary.awaiting_review > 0 && can(user, "payments.verify") && (
        <Card className="flex flex-col gap-3 border-warning/40 bg-warning-soft/40 p-5 sm:flex-row sm:items-center">
          <Landmark className="size-6 shrink-0 text-warning" />
          <p className="flex-1 text-sm text-foreground">
            <strong>{summary.awaiting_review} bank transfer{summary.awaiting_review === 1 ? "" : "s"}</strong> waiting for you to check against the bank statement.
          </p>
          <ButtonLink href="/admin/finance/transfers" size="sm">
            Review now <ArrowRight className="size-4" />
          </ButtonLink>
        </Card>
      )}

      <Panel icon={TrendingUp} title="Revenue in NGN">
        <div className="px-5 pb-6 pt-8 sm:px-7">
          <BarChart
            caption="Money received per month, last six months"
            unit="received"
            format="naira"
            data={summary.revenue_by_month.map((month) => ({
              key: month.month,
              label: month.label,
              value: month.value / 100,
              tooltip: monthYear.format(new Date(`${month.month}-01T00:00:00Z`)),
            }))}
          />
        </div>
      </Panel>

      <Card className="overflow-hidden">
        <form className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:p-5">
          <label className="relative flex-1">
            <span className="sr-only">Search payments</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              name="q"
              defaultValue={search}
              placeholder="Reference, receipt, invoice or customer"
              className="h-10 w-full rounded-xl border border-border bg-surface pl-10 pr-3 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
            />
          </label>
          <select name="status" defaultValue={status} aria-label="Filter by status" className="h-10 rounded-xl border border-border bg-surface px-3 text-sm text-foreground">
            {statuses.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button type="submit" className={buttonClasses({ variant: "navy", size: "sm", className: "h-10" })}>
            Filter
          </button>
        </form>
        {payments.length === 0 ? (
          <EmptyState icon={Wallet} title={status || search ? "No payments match" : "No payments yet"} description="Payments appear here as customers pay their invoices." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-surface-muted text-xs font-semibold uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-3">Payment</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Method</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.map((payment) => (
                  <tr key={payment.reference} className="hover:bg-surface-muted/50">
                    <td className="px-5 py-3.5">
                      <Link href={`/admin/finance/payments/${payment.reference}`} className="font-mono text-xs font-semibold text-foreground hover:text-brand-600">
                        {payment.reference}
                      </Link>
                      <p className="text-xs text-muted">{payment.invoice?.number}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-foreground">{payment.customer?.name}</p>
                      <p className="text-xs text-muted">{payment.customer?.email}</p>
                    </td>
                    <td className="px-5 py-3.5 text-muted">
                      {payment.gateway_label} {payment.mode === "test" && payment.gateway !== "bank_transfer" && <Badge tone="warning">Test</Badge>}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right font-semibold text-foreground">{formatNaira(payment.amount)}</td>
                    <td className="px-5 py-3.5">
                      <PaymentStatusBadge payment={payment} />
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-muted">{formatDateTime(payment.paid_at ?? payment.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function FinanceSkeleton() {
  return (
    <div className="space-y-6" aria-busy>
      <StatTilesSkeleton />
      <Skeleton className="h-80 rounded-2xl" />
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}
