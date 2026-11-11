import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, CalendarClock, RefreshCw, Wallet } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import type { RenewalRow, RenewalsOverview } from "@/lib/types";
import { formatDate, formatDateTime, formatNaira } from "@/lib/utils";

export const metadata: Metadata = { title: "Renewals" };

export default function RenewalsPage() {
  return (
    <>
      <PageHeader
        title="Renewals and money owed"
        description="Passes and memberships ending in the next 14 days, renewals that failed, and overdue invoices. Customers are emailed automatically; this is where you follow up by hand."
      />
      <Suspense fallback={<Skeleton className="h-[480px] rounded-2xl" />}>
        <Renewals />
      </Suspense>
    </>
  );
}

async function Renewals() {
  await requireStaff("payments.view");
  const overview = await api<RenewalsOverview>("/admin/finance/renewals");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={CalendarClock} label="Renewing in the next 14 days" value={formatNaira(overview.stats.renewing_14_days)} />
        <Stat icon={RefreshCw} label="Of those, set to renew automatically" value={overview.stats.auto_renew_share === null ? "None due" : `${overview.stats.auto_renew_share}%`} />
        <Stat icon={Wallet} label="Overdue invoices" value={formatNaira(overview.stats.overdue_total)} tone={overview.stats.overdue_total > 0 ? "text-danger" : undefined} />
      </div>

      {overview.failed.length > 0 && (
        <Card className="overflow-hidden border-danger/30">
          <CardHeader title="Renewals that failed" description="The card was declined or missing. The customer has a pay link; a call often helps." />
          <RenewalList rows={overview.failed} />
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader title="Ending in the next 14 days" />
        {overview.upcoming.length === 0 ? <EmptyState icon={CalendarClock} title="Nothing ending soon" description="Passes and memberships ending in the next two weeks show here." /> : <RenewalList rows={overview.upcoming} />}
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="Overdue invoices" description="Customers get reminders on the due date, then 3 and 7 days later." />
        {overview.overdue.length === 0 ? (
          <EmptyState icon={Wallet} title="Nothing overdue" description="Unpaid invoices past their due date show here." />
        ) : (
          <ul className="divide-y divide-border">
            {overview.overdue.map((invoice) => (
              <li key={invoice.id}>
                <Link href={`/admin/finance/invoices/${invoice.id}`} className="flex flex-wrap items-center gap-3 px-5 py-4 hover:bg-surface-muted/50 sm:px-6">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">
                      {invoice.number} <span className="font-normal text-muted">· {invoice.customer.name}</span>
                    </p>
                    <p className="text-sm text-muted">
                      Due {formatDate(invoice.due_at)} · {invoice.reminders_sent} reminder{invoice.reminders_sent === 1 ? "" : "s"} sent · {invoice.customer.email}
                    </p>
                  </div>
                  <span className="font-semibold text-danger">{formatNaira(invoice.balance)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function RenewalList({ rows }: { rows: RenewalRow[] }) {
  return (
    <ul className="divide-y divide-border">
      {rows.map((row) => (
        <li key={`${row.kind}-${row.id}`} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground">{row.customer.name}</span>
              <span className="text-sm text-muted">
                {row.name} {row.kind}
              </span>
              {row.auto_renew ? <Badge tone={row.card ? "success" : "warning"}>{row.card ? `Auto · ${row.card}` : "Auto · no card"}</Badge> : <Badge>Manual</Badge>}
            </p>
            <p className="text-sm text-muted">
              {row.status === "expired" ? "Ended" : "Ends"} {formatDate(row.ends_at)} · {row.customer.email}
              {row.last_attempt_at && ` · last try ${formatDateTime(row.last_attempt_at)} (${row.attempts} of 3)`}
            </p>
            {row.failure && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-danger">
                <AlertTriangle className="size-3.5" /> {row.failure}
              </p>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm">
            {row.price !== null && <span className="font-semibold text-foreground">{formatNaira(row.price)}</span>}
            {row.renewal_invoice_id && (
              <Link href={`/admin/finance/invoices/${row.renewal_invoice_id}`} className="font-semibold text-brand-600 hover:underline">
                Invoice
              </Link>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof Wallet; label: string; value: string; tone?: string }) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-foreground">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className={`block text-2xl font-bold ${tone ?? "text-foreground"}`}>{value}</span>
        <span className="block text-sm text-muted">{label}</span>
      </span>
    </Card>
  );
}
