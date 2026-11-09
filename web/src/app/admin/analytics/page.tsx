import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowDownRight, ArrowUpRight, Download } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { BarChart } from "@/components/app/bar-chart";
import { RankedBars } from "@/components/admin/reports/ranked-bars";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import type { BusinessReport } from "@/lib/types";
import { cn, formatNaira } from "@/lib/utils";

export const metadata: Metadata = { title: "Analytics" };

const presets = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "ytd", label: "This year" },
];

type Query = { preset?: string; from?: string; to?: string };

const shortDate = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const dateLabel = (date: string) => shortDate.format(new Date(`${date}T12:00:00Z`));

export default function AnalyticsPage({ searchParams }: PageProps<"/admin/analytics">) {
  return (
    <Suspense fallback={<Skeleton className="h-[640px] rounded-2xl" />}>
      {searchParams.then((params) => {
        const pick = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);
        const custom = pick("from") && pick("to");
        const query: Query = custom ? { from: pick("from"), to: pick("to") } : { preset: presets.some((item) => item.value === pick("preset")) ? pick("preset") : "30d" };
        return <Analytics query={query} />;
      })}
    </Suspense>
  );
}

async function Analytics({ query }: { query: Query }) {
  await requireStaff("reports.view");
  const params = new URLSearchParams(query as Record<string, string>);
  const report = await api<BusinessReport>(`/admin/reports/summary?${params}`);
  const { totals } = report;
  const change = totals.previous_collected > 0 ? Math.round(((totals.collected - totals.previous_collected) / totals.previous_collected) * 100) : null;
  const daily = report.revenue_interval === "day";

  const tiles = [
    {
      label: "Money collected",
      value: formatNaira(totals.collected),
      note:
        change === null ? (
          `${totals.payments} payment${totals.payments === 1 ? "" : "s"}`
        ) : (
          <span className="inline-flex items-center gap-1">
            {change >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {Math.abs(change)}% vs the period before
          </span>
        ),
    },
    { label: "After refunds", value: formatNaira(totals.net), note: totals.refunded > 0 ? `${formatNaira(totals.refunded)} refunded` : "No refunds" },
    { label: "Space bookings", value: totals.bookings.toLocaleString(), note: `${totals.booked_hours.toLocaleString()} hours booked · ${totals.cancelled_bookings} cancelled` },
    { label: "Service orders", value: totals.orders.toLocaleString(), note: "Paid in this period" },
    { label: "New customers", value: totals.new_customers.toLocaleString(), note: `Plus ${totals.new_guests} guest${totals.new_guests === 1 ? "" : "s"} who booked` },
  ];

  return (
    <>
      <PageHeader
        title="Analytics"
        description={`${dateLabel(report.from)} to ${dateLabel(report.to)}`}
        actions={
          <a href={`/admin/analytics/payments.csv?${params}`} download className={buttonClasses({ variant: "outline" })}>
            <Download className="size-4" /> Download payments (CSV)
          </a>
        }
      />

      {/* Filters sit in one row above everything they affect. */}
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Date range" className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <Link
              key={preset.value}
              href={`/admin/analytics?preset=${preset.value}`}
              aria-current={query.preset === preset.value ? "page" : undefined}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                query.preset === preset.value ? "border-navy-900 bg-navy-900 text-white dark:border-navy-700 dark:bg-navy-700" : "border-border bg-surface text-foreground hover:border-navy-200",
              )}
            >
              {preset.label}
            </Link>
          ))}
        </nav>
        <form action="/admin/analytics" className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-muted">
            From
            <input type="date" name="from" defaultValue={report.from} required className="mt-1 block h-10 rounded-xl border border-border bg-surface px-3 text-sm text-foreground" />
          </label>
          <label className="text-xs text-muted">
            To
            <input type="date" name="to" defaultValue={report.to} required className="mt-1 block h-10 rounded-xl border border-border bg-surface px-3 text-sm text-foreground" />
          </label>
          <Button type="submit" variant="outline" className="h-10">
            Apply
          </Button>
        </form>
      </div>

      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {tiles.map((tile) => (
            <Card key={tile.label} className="p-5">
              <p className="text-sm text-muted">{tile.label}</p>
              <p className="mt-1 font-sans text-2xl font-bold text-foreground">{tile.value}</p>
              <p className="mt-1 text-xs text-muted">{tile.note}</p>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader title="Money collected" description={daily ? "By day" : "By week"} />
          <div className="p-5 sm:p-6">
            {totals.collected === 0 ? (
              <p className="py-12 text-center text-sm text-muted">No payments in this period.</p>
            ) : (
              <BarChart
                data={report.revenue_series.map((point) => ({ key: point.key, label: point.label, value: point.amount / 100 }))}
                unit="collected"
                format="naira"
                period={daily ? "Day" : "Week"}
                caption={`Money collected ${daily ? "each day" : "each week"}, ${dateLabel(report.from)} to ${dateLabel(report.to)}`}
              />
            )}
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Where the money came from" />
            <RankedBars
              rows={report.revenue_by_source.map((row) => ({ label: row.source, amount: row.amount, count: row.count }))}
              caption="Money collected by what it was for"
              detail={(count) => `${count} payment${count === 1 ? "" : "s"}`}
            />
          </Card>
          <Card>
            <CardHeader title="How people paid" />
            <RankedBars
              rows={report.payment_methods.map((row) => ({ label: row.method, amount: row.amount, count: row.count }))}
              caption="Money collected by payment method"
              detail={(count) => `${count} payment${count === 1 ? "" : "s"}`}
            />
          </Card>
        </div>

        <Card>
          <CardHeader title="Spaces" description="Bookings that started in this period. Use is booked hours against opening hours (seat-hours for shared spaces)." />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-border text-left text-xs text-muted">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium sm:px-6">Space</th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">Bookings</th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">Hours</th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">Takings</th>
                  <th scope="col" className="px-5 py-3 font-medium sm:px-6">Use</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {report.spaces.map((space) => (
                  <tr key={`${space.location}-${space.space}`}>
                    <th scope="row" className="px-5 py-3 text-left font-medium text-foreground sm:px-6">
                      {space.space}
                      <span className="block text-xs font-normal text-muted">{space.location}</span>
                    </th>
                    <td className="px-3 py-3 text-right text-foreground">{space.bookings}</td>
                    <td className="px-3 py-3 text-right text-foreground">{space.hours}</td>
                    <td className="px-3 py-3 text-right font-semibold text-foreground">{formatNaira(space.amount)}</td>
                    <td className="px-5 py-3 sm:px-6">
                      <span className="flex items-center gap-3">
                        <span className="h-2 w-28 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
                          <span className="block h-full rounded-full bg-chart-bar" style={{ width: `${space.occupancy}%` }} />
                        </span>
                        <span className="text-foreground">{space.occupancy}%</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader title="Business services sold" description="Top 10 by orders paid in this period" />
            {report.services.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted sm:px-6">No service orders in this period.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs text-muted">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-medium sm:px-6">Service</th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">Orders</th>
                    <th scope="col" className="px-5 py-3 text-right font-medium sm:px-6">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {report.services.map((service) => (
                    <tr key={service.service}>
                      <th scope="row" className="px-5 py-3 text-left font-medium text-foreground sm:px-6">{service.service}</th>
                      <td className="px-3 py-3 text-right text-foreground">{service.orders}</td>
                      <td className="px-5 py-3 text-right font-semibold text-foreground sm:px-6">{formatNaira(service.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          <Card>
            <CardHeader title="Passes and memberships" />
            <dl className="divide-y divide-border text-sm">
              {[
                ["Passes sold", report.plans.passes_sold],
                ["Memberships started", report.plans.memberships_sold],
                ["Active memberships now", report.plans.active_memberships],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between px-5 py-3 sm:px-6">
                  <dt className="text-muted">{label}</dt>
                  <dd className="text-lg font-bold text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}
