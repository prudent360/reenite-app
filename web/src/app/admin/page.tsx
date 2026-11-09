import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowRight,
  ClipboardList,
  MailWarning,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { BarChart } from "@/components/app/bar-chart";
import { HeroBanner, Panel, StatTile, StatTilesSkeleton } from "@/components/app/dashboard-widgets";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Badge, EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { can, requireStaff } from "@/lib/session";
import type { OrderSummary, User } from "@/lib/types";
import { firstName, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

type Summary = {
  stats: { customers: number; new_customers_7d: number; new_customers_30d: number; unverified_customers: number; staff: number };
  signups_by_month: { month: string; label: string; value: number }[];
  /** Only sent to roles that can see payments. Kobo. */
  revenue_by_month: { month: string; label: string; value: number }[] | null;
  recent_customers: User[];
};

export default function AdminOverviewPage({ searchParams }: PageProps<"/admin">) {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <Overview searchParams={searchParams} />
    </Suspense>
  );
}

function greeting(): string {
  const hour = Number(new Intl.DateTimeFormat("en-NG", { hour: "numeric", hour12: false, timeZone: "Africa/Lagos" }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

const monthYear = new Intl.DateTimeFormat("en-NG", { month: "long", year: "numeric", timeZone: "UTC" });

const viewAll = (href: string, label = "View all") => (
  <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
    {label} <ArrowRight className="size-4" />
  </Link>
);

async function Overview({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  // Authorize before fetching, so non-staff are redirected instead of hitting a 403.
  const user = await requireStaff();
  const canSeeOrders = can(user, "orders.view_all") || can(user, "orders.view_assigned");
  const [params, summary, pipeline] = await Promise.all([
    searchParams,
    api<Summary>("/admin/dashboard"),
    canSeeOrders ? api<OrderSummary>("/admin/orders/summary") : Promise.resolve(null),
  ]);
  const { stats } = summary;
  const canSeeCustomers = can(user, "customers.view");

  return (
    <div className="space-y-6 lg:space-y-8">
      {params.denied && (
        <Alert tone="danger" icon={ShieldAlert}>
          Your role doesn&apos;t have access to that page. Ask a Super Admin if you need it.
        </Alert>
      )}

      <HeroBanner
        title={`${greeting()}, ${firstName(user.name)}`}
        subtitle="Here's how Reenite is doing."
        actions={
          <>
            {can(user, "staff.manage") && (
              <ButtonLink href="/admin/staff" variant="light">
                <UserPlus className="size-4" /> Invite staff
              </ButtonLink>
            )}
            {canSeeCustomers && (
              <ButtonLink href="/admin/customers" variant="glass">
                <Users className="size-4" /> Customers
              </ButtonLink>
            )}
          </>
        }
        stats={[
          { value: stats.customers.toLocaleString(), label: "Customers" },
          { value: stats.new_customers_30d.toLocaleString(), label: "New, 30 days" },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={Users} tone="navy" value={stats.customers.toLocaleString()} label="Customers" hint={`+${stats.new_customers_30d} in the last 30 days`} />
        <StatTile icon={UserPlus} tone="brand" value={stats.new_customers_7d.toLocaleString()} label="New this week" hint="Signed up in the last 7 days" />
        <StatTile icon={MailWarning} tone="info" value={stats.unverified_customers.toLocaleString()} label="Unverified emails" hint="Still need to confirm" />
        <StatTile icon={ShieldCheck} tone="solid" value={stats.staff.toLocaleString()} label="Staff accounts" hint="Across all roles" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel icon={TrendingUp} title="New customers per month" action={canSeeCustomers && viewAll("/admin/customers")}>
          <div className="px-5 pb-6 pt-8 sm:px-7">
            <BarChart
              caption="New customer sign-ups per month, last six months"
              unit="new customers"
              data={summary.signups_by_month.map((month) => ({
                key: month.month,
                label: month.label,
                value: month.value,
                tooltip: monthYear.format(new Date(`${month.month}-01T00:00:00Z`)),
              }))}
            />
          </div>
        </Panel>

        {summary.revenue_by_month && (
          <Panel icon={Wallet} title="Revenue in NGN" action={viewAll("/admin/finance")}>
            {summary.revenue_by_month.some((month) => month.value > 0) ? (
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
            ) : (
              <EmptyState
                icon={Wallet}
                title="No payments yet"
                description="Monthly revenue will chart here as customers pay their invoices."
                className="py-16"
              />
            )}
          </Panel>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel icon={Users} title="Newest customers" action={canSeeCustomers && viewAll("/admin/customers")}>
          {summary.recent_customers.length === 0 ? (
            <EmptyState icon={Users} title="No customers yet" description="New sign-ups will appear here." />
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {summary.recent_customers.map((customer) => (
                <li key={customer.id} className="flex items-center gap-3 px-5 py-4 sm:px-7">
                  <Avatar name={customer.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground">{customer.name}</p>
                    <p className="truncate text-sm text-muted">{customer.email}</p>
                  </div>
                  <div className="text-right">
                    {customer.email_verified ? <Badge tone="success">Verified</Badge> : <Badge tone="warning">Unverified</Badge>}
                    <p className="mt-1 hidden text-xs text-muted sm:block">Joined {formatDate(customer.created_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {pipeline && (
          <Panel icon={ClipboardList} title="Order pipeline" action={viewAll("/admin/orders", "Open board")}>
            <PipelinePanel pipeline={pipeline} />
          </Panel>
        )}
      </div>
    </div>
  );
}

function PipelinePanel({ pipeline }: { pipeline: OrderSummary }) {
  const rows = [
    { label: "Received, not started", value: pipeline.by_status.received, href: "/admin/orders" },
    { label: "In progress", value: pipeline.by_status.in_progress, href: "/admin/orders" },
    { label: "Waiting on customer", value: pipeline.by_status.awaiting_client, href: "/admin/orders" },
    { label: "Awaiting payment", value: pipeline.by_status.awaiting_payment, href: "/admin/orders?view=awaiting_payment" },
  ] as const;
  const flags = [
    { label: "Overdue", value: pipeline.overdue, href: "/admin/orders?overdue=1", tone: "danger" },
    { label: "Assigned to you", value: pipeline.mine, href: "/admin/orders?assigned=me", tone: "navy" },
    { label: "Unassigned", value: pipeline.unassigned, href: "/admin/orders?assigned=unassigned", tone: "brand" },
  ] as const;

  return (
    <div className="space-y-5 px-5 pb-6 pt-4 sm:px-7">
      <div className="grid grid-cols-3 gap-3">
        {flags.map((flag) => (
          <Link key={flag.label} href={flag.href} className="rounded-xl border border-border p-3 transition hover:border-brand-500/50">
            <p className={`font-display text-2xl font-extrabold ${flag.value > 0 && flag.tone === "danger" ? "text-danger" : "text-foreground"}`}>{flag.value}</p>
            <p className="text-xs text-muted">{flag.label}</p>
          </Link>
        ))}
      </div>
      <ul className="divide-y divide-border">
        {rows.map((row) => (
          <li key={row.label}>
            <Link href={row.href} className="flex items-center justify-between py-3 text-sm hover:text-brand-600">
              <span className="text-foreground">{row.label}</span>
              <span className="font-semibold text-foreground">{row.value}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">{pipeline.by_status.completed} completed to date.</p>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6 lg:space-y-8" aria-busy>
      <Skeleton className="h-56 rounded-3xl" />
      <StatTilesSkeleton />
      <div className="grid gap-6 xl:grid-cols-2">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  );
}
