import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarCheck2, Search } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { ComplianceStaffActions } from "@/components/admin/compliance/compliance-staff-actions";
import { daysLeftLabel, stateBadges } from "@/components/businesses/health";
import { buttonClasses } from "@/components/ui/button";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import type { ComplianceItem, Paginated } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Compliance" };

const filters = [
  { key: "attention", label: "Needs attention" },
  { key: "overdue", label: "Overdue" },
  { key: "due_soon", label: "Next 30 days" },
  { key: "open", label: "All open" },
  { key: "done", label: "Done" },
] as const;

type Filter = (typeof filters)[number]["key"];

export default function CompliancePage({ searchParams }: PageProps<"/admin/compliance">) {
  return (
    <>
      <PageHeader title="Compliance" description="Customers' filing deadlines across all their businesses. Offer to file the ones coming up, and record filings you did for them." />
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        {searchParams.then((query) => {
          const filter = filters.some((option) => option.key === query.filter) ? (query.filter as Filter) : "attention";
          return <ComplianceQueue filter={filter} search={typeof query.q === "string" ? query.q : ""} />;
        })}
      </Suspense>
    </>
  );
}

async function ComplianceQueue({ filter, search }: { filter: Filter; search: string }) {
  await requireStaff("compliance.manage");
  const query = new URLSearchParams({ filter });
  if (search) query.set("search", search);
  const { data: items, meta, counts } = await api<Paginated<ComplianceItem> & { counts: { overdue: number; due_soon: number; businesses: number } }>(`/admin/compliance?${query}`);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Overdue" value={counts.overdue} tone="text-danger" />
        <Stat label="Due in the next 30 days" value={counts.due_soon} tone="text-warning" />
        <Stat label="Businesses on the calendar" value={counts.businesses} tone="text-foreground" />
      </div>

      <Card className="overflow-hidden">
        <nav aria-label="Filter deadlines" className="flex gap-1 overflow-x-auto border-b border-border px-3">
          {filters.map((option) => (
            <Link
              key={option.key}
              href={`/admin/compliance?${new URLSearchParams({ filter: option.key, ...(search ? { q: search } : {}) })}`}
              aria-current={filter === option.key ? "page" : undefined}
              className={cn(
                "-mb-px shrink-0 border-b-2 px-3 py-3 text-sm font-semibold transition-colors",
                filter === option.key ? "border-brand-500 text-foreground" : "border-transparent text-muted hover:text-foreground",
              )}
            >
              {option.label}
            </Link>
          ))}
        </nav>
        <form className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:p-5">
          <input type="hidden" name="filter" value={filter} />
          <label className="relative flex-1">
            <span className="sr-only">Search</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              name="q"
              defaultValue={search}
              placeholder="Business, CAC number, customer name or email"
              className="h-10 w-full rounded-xl border border-border bg-surface pl-10 pr-3 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
            />
          </label>
          <button type="submit" className={buttonClasses({ variant: "navy", size: "sm", className: "h-10" })}>
            Search
          </button>
        </form>

        {items.length === 0 ? (
          <EmptyState icon={CalendarCheck2} title={search ? "Nothing matches" : "Nothing here"} description={search ? "Try another name or number." : "No customer deadlines in this view."} />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => {
              const badge = stateBadges[item.state];
              const owner = item.business?.owner;
              return (
                <li key={item.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">{item.title}</span>
                      {item.period_label && <span className="text-sm text-muted">{item.period_label}</span>}
                      <Badge tone={badge.tone}>{badge.label}</Badge>
                    </p>
                    <p className="mt-0.5 text-sm text-muted">
                      <span className="font-medium text-foreground">{item.business?.name}</span>
                      {owner && (
                        <>
                          {" · "}
                          {owner.name} ({owner.email})
                        </>
                      )}
                    </p>
                    <p className="text-sm text-muted">
                      Due {formatDate(item.due_on)}
                      {item.status === "open" && <span className={cn("font-medium", item.days_left < 0 ? "text-danger" : "text-warning")}> · {daysLeftLabel(item)}</span>}
                      {item.note && <span> · {item.note}</span>}
                    </p>
                  </div>
                  <ComplianceStaffActions item={item} />
                </li>
              );
            })}
          </ul>
        )}
        {meta.last_page > 1 && <p className="border-t border-border px-5 py-3 text-sm text-muted sm:px-6">Showing the first {meta.per_page} of {meta.total}. Search to narrow it down.</p>}
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <Card className="p-5">
      <p className={cn("text-3xl font-bold", tone)}>{value}</p>
      <p className="mt-1 text-sm text-muted">{label}</p>
    </Card>
  );
}
