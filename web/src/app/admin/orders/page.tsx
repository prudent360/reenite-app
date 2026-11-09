import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AlarmClock, ClipboardList, Search, UserRound } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { OrderStatusBadge, ProgressBar } from "@/components/orders/order-parts";
import { buttonClasses } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { can, requireStaff } from "@/lib/session";
import type { Order, OrderStatus, OrderSummary, Paginated } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Orders" };

const views = {
  active: { label: "Pipeline", statuses: ["received", "in_progress", "awaiting_client"] },
  awaiting_payment: { label: "Awaiting payment", statuses: ["awaiting_payment"] },
  completed: { label: "Completed", statuses: ["completed"] },
  cancelled: { label: "Cancelled", statuses: ["cancelled"] },
} satisfies Record<string, { label: string; statuses: OrderStatus[] }>;

type View = keyof typeof views;

const columns: { status: OrderStatus; title: string }[] = [
  { status: "received", title: "Received" },
  { status: "in_progress", title: "In progress" },
  { status: "awaiting_client", title: "Waiting on customer" },
];

export default function OrdersAdminPage({ searchParams }: PageProps<"/admin/orders">) {
  return (
    <>
      <PageHeader title="Orders" description="The done-for-you pipeline: assign, file and deliver." />
      <Suspense fallback={<Skeleton className="h-[520px] rounded-2xl" />}>
        <Board searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Board({ searchParams }: { searchParams: PageProps<"/admin/orders">["searchParams"] }) {
  const user = await requireStaff();
  const params = await searchParams;
  const view: View = typeof params.view === "string" && params.view in views ? (params.view as View) : "active";
  const assigned = params.assigned === "me" || params.assigned === "unassigned" ? params.assigned : "";
  const search = typeof params.q === "string" ? params.q : "";
  const overdue = params.overdue === "1";
  const seesAll = can(user, "orders.view_all");

  const query = new URLSearchParams({ status: views[view].statuses.join(",") });
  if (assigned) query.set("assigned", assigned);
  if (search) query.set("search", search);
  if (overdue) query.set("overdue", "1");

  const [{ data: orders }, summary] = await Promise.all([api<Paginated<Order>>(`/admin/orders?${query}`), api<OrderSummary>("/admin/orders/summary")]);

  const link = (patch: Record<string, string>) => {
    const next = new URLSearchParams({ ...(view !== "active" && { view }), ...(assigned && { assigned }), ...(search && { q: search }), ...(overdue && { overdue: "1" }), ...patch });
    [...next.entries()].forEach(([key, value]) => !value && next.delete(key));
    const qs = next.toString();
    return (qs ? `/admin/orders?${qs}` : "/admin/orders") as `/admin/orders`;
  };

  const counts: Record<View, number> = {
    active: summary.by_status.received + summary.by_status.in_progress + summary.by_status.awaiting_client,
    awaiting_payment: summary.by_status.awaiting_payment,
    completed: summary.by_status.completed,
    cancelled: summary.by_status.cancelled,
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(views) as View[]).map((key) => (
          <Link
            key={key}
            href={link({ view: key === "active" ? "" : key })}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition",
              view === key ? "border-navy-900 bg-navy-900 text-white dark:border-navy-700 dark:bg-navy-700" : "border-border bg-surface text-muted hover:text-foreground",
            )}
          >
            {views[key].label}
            <span className={cn("rounded-md px-1.5 text-xs", view === key ? "bg-white/15" : "bg-surface-muted")}>{counts[key]}</span>
          </Link>
        ))}
      </div>

      <Card className="p-4">
        <form className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {view !== "active" && <input type="hidden" name="view" value={view} />}
          <label className="relative flex-1">
            <span className="sr-only">Search orders</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input name="q" defaultValue={search} placeholder="Reference, service or customer" className="h-10 w-full rounded-xl border border-border bg-surface pl-10 pr-3 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15" />
          </label>
          {seesAll && (
            <select name="assigned" defaultValue={assigned} aria-label="Filter by officer" className="h-10 rounded-xl border border-border bg-surface px-3 text-sm text-foreground">
              <option value="">Everyone</option>
              <option value="me">Assigned to me</option>
              <option value="unassigned">Unassigned</option>
            </select>
          )}
          {view === "active" && (
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" name="overdue" value="1" defaultChecked={overdue} className="accent-[#f05a28]" /> Overdue only
            </label>
          )}
          <button type="submit" className={buttonClasses({ variant: "navy", size: "sm", className: "h-10" })}>
            Filter
          </button>
        </form>
        {(summary.overdue > 0 || (seesAll && summary.unassigned > 0)) && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3 text-sm">
            {summary.overdue > 0 && (
              <Link href={link({ view: "", overdue: "1" })} className="inline-flex items-center gap-1.5 font-semibold text-danger hover:underline">
                <AlarmClock className="size-4" /> {summary.overdue} overdue
              </Link>
            )}
            {seesAll && summary.unassigned > 0 && (
              <Link href={link({ view: "", assigned: "unassigned" })} className="inline-flex items-center gap-1.5 font-semibold text-brand-600 hover:underline">
                <UserRound className="size-4" /> {summary.unassigned} waiting for an officer
              </Link>
            )}
          </div>
        )}
      </Card>

      {view === "active" ? (
        <div className="grid gap-5 lg:grid-cols-3">
          {columns.map((column) => {
            const items = orders.filter((order) => order.status === column.status);
            return (
              <section key={column.status} aria-label={column.title} className="rounded-2xl border border-border bg-surface-muted/60 p-3">
                <h2 className="mb-3 flex items-center justify-between px-1 text-sm font-bold text-foreground">
                  {column.title}
                  <span className="rounded-md bg-surface px-2 py-0.5 text-xs font-semibold text-muted">{items.length}</span>
                </h2>
                <div className="space-y-3">
                  {items.map((order) => <OrderCard key={order.reference} order={order} />)}
                  {items.length === 0 && <p className="px-1 py-8 text-center text-sm text-muted">Nothing here</p>}
                </div>
              </section>
            );
          })}
        </div>
      ) : orders.length === 0 ? (
        <Card>
          <EmptyState icon={ClipboardList} title="No orders here" description={search || assigned ? "Try clearing the filters." : "Orders will show up here as customers place them."} className="py-16" />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-surface-muted text-xs font-semibold uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-3">Order</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Officer</th>
                  <th className="px-5 py-3">Placed</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((order) => (
                  <tr key={order.reference} className="hover:bg-surface-muted/50">
                    <td className="px-5 py-3.5">
                      <Link href={`/admin/orders/${order.reference}`} className="font-semibold text-foreground hover:text-brand-600">{order.service.name}</Link>
                      <p className="font-mono text-xs text-muted">{order.reference}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-foreground">{order.customer?.name}</p>
                      <p className="text-xs text-muted">{order.customer?.email}</p>
                    </td>
                    <td className="px-5 py-3.5 text-muted">{order.officer?.name ?? "Unassigned"}</td>
                    <td className="px-5 py-3.5 text-muted">{formatDate(order.created_at)}</td>
                    <td className="px-5 py-3.5"><OrderStatusBadge order={order} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function OrderCard({ order }: { order: Order }) {
  const current = order.stages.find((stage) => stage.state === "current");
  return (
    <Link href={`/admin/orders/${order.reference}`} className={cn("block rounded-xl border bg-surface p-4 shadow-card transition hover:border-brand-500/50", order.is_overdue ? "border-danger/50" : "border-border")}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-[11px] text-muted">{order.reference}</p>
        {order.is_overdue && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-danger"><AlarmClock className="size-3" /> Overdue</span>}
      </div>
      <p className="mt-1 font-semibold text-foreground">{order.service.name}</p>
      <p className="truncate text-sm text-muted">{order.customer?.name}</p>
      <div className="mt-3"><ProgressBar value={order.progress} /></div>
      <div className="mt-2.5 flex items-center justify-between gap-2 text-xs">
        <span className="truncate text-muted">{current?.name ?? order.status_label}</span>
        <span className={cn("shrink-0", order.is_overdue ? "font-semibold text-danger" : "text-muted")}>{order.due_at ? `Due ${formatDate(order.due_at)}` : ""}</span>
      </div>
      <p className={cn("mt-2 flex items-center gap-1.5 border-t border-border pt-2 text-xs", order.officer ? "text-foreground" : "font-semibold text-brand-600")}>
        <UserRound className="size-3.5" /> {order.officer?.name ?? "Unassigned"}
      </p>
    </Link>
  );
}
