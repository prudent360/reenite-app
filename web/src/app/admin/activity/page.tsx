import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight, History, LogIn, LogOut, PencilLine, Search, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { buttonClasses } from "@/components/ui/button";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import type { ActivityEvent, ActivityLogEntry, Paginated } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Activity log" };

const events: { value: ActivityEvent; label: string; icon: typeof History }[] = [
  { value: "admin.change", label: "Admin changes", icon: PencilLine },
  { value: "auth.login", label: "Sign-ins", icon: LogIn },
  { value: "auth.login_failed", label: "Failed sign-ins", icon: ShieldAlert },
  { value: "auth.logout", label: "Sign-outs", icon: LogOut },
];

export default function ActivityPage({ searchParams }: PageProps<"/admin/activity">) {
  return (
    <>
      <PageHeader
        title="Activity log"
        description="Every change made in the admin, every sign-in and every failed sign-in, kept for a year. Only Super Admins can see this page."
      />
      <Suspense fallback={<TableSkeleton />}>
        <ActivityTable searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ActivityTable({ searchParams }: { searchParams: PageProps<"/admin/activity">["searchParams"] }) {
  await requireStaff("audit.view");
  const params = await searchParams;
  const text = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : "");
  const search = text("q");
  const event = events.some((item) => item.value === params.event) ? text("event") : "";
  const from = /^\d{4}-\d{2}-\d{2}$/.test(text("from")) ? text("from") : "";
  const to = /^\d{4}-\d{2}-\d{2}$/.test(text("to")) ? text("to") : "";
  const page = Math.max(1, Number(params.page) || 1);

  const filters = { ...(search && { search }), ...(event && { event }), ...(from && { from }), ...(to && { to }) };
  const { data: entries, meta } = await api<Paginated<ActivityLogEntry>>(`/admin/activity?${new URLSearchParams({ ...filters, page: String(page), per_page: "30" })}`);

  const pageHref = (target: number) => {
    const next = new URLSearchParams({ ...(search && { q: search }), ...(event && { event }), ...(from && { from }), ...(to && { to }), page: String(target) });
    return `/admin/activity?${next}`;
  };

  const field = "h-10 rounded-xl border border-border bg-surface px-3 text-sm focus:border-brand-500 focus:outline-none";

  return (
    <Card className="overflow-hidden">
      <form className="grid gap-3 border-b border-border p-4 sm:p-5 lg:grid-cols-[1fr_auto_auto_auto_auto] lg:items-center">
        <label className="relative">
          <span className="sr-only">Search activity</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-navy-400" />
          <input
            name="q"
            defaultValue={search}
            placeholder="Search by person, email, action or IP address"
            className="h-10 w-full rounded-xl border border-border bg-surface pl-10 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
          />
        </label>
        <select name="event" defaultValue={event} aria-label="Filter by type" className={field}>
          <option value="">Everything</option>
          {events.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-muted">
          From <input type="date" name="from" defaultValue={from} className={field} />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          To <input type="date" name="to" defaultValue={to} className={field} />
        </label>
        <button type="submit" className={buttonClasses({ variant: "navy", size: "sm", className: "h-10" })}>
          Filter
        </button>
      </form>

      {entries.length === 0 ? (
        <EmptyState icon={History} title="No activity found" description={search || event || from || to ? "Nothing matches these filters." : "Changes and sign-ins will appear here."} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-surface-muted text-xs font-semibold text-muted">
              <tr>
                <th className="px-5 py-3">When</th>
                <th className="px-5 py-3">Who</th>
                <th className="px-5 py-3">What happened</th>
                <th className="px-5 py-3">Result</th>
                <th className="px-5 py-3">From</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((entry) => (
                <ActivityRow key={entry.id} entry={entry} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {meta.last_page > 1 && (
        <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm">
          <p className="text-muted">
            {meta.from} to {meta.to} of {meta.total}
          </p>
          <div className="flex gap-2">
            <PageLink href={pageHref(page - 1)} disabled={page <= 1} label="Previous page">
              <ChevronLeft className="size-4" />
            </PageLink>
            <PageLink href={pageHref(page + 1)} disabled={page >= meta.last_page} label="Next page">
              <ChevronRight className="size-4" />
            </PageLink>
          </div>
        </div>
      )}
    </Card>
  );
}

function ActivityRow({ entry }: { entry: ActivityLogEntry }) {
  const meta = events.find((item) => item.value === entry.event);
  const Icon = meta?.icon ?? History;
  const fields = entry.properties.fields ?? [];
  const subject = Object.entries(entry.properties.subject ?? {});

  return (
    <tr className="align-top hover:bg-surface-muted/50">
      <td className="whitespace-nowrap px-5 py-3.5 text-muted">{formatDateTime(entry.created_at)}</td>
      <td className="px-5 py-3.5">
        {entry.user ? (
          <>
            <p className="font-semibold text-foreground">{entry.user.name}</p>
            <p className="text-xs text-muted">{entry.user.email}</p>
          </>
        ) : (
          <p className="text-muted">{entry.properties.email ?? "Unknown"}</p>
        )}
      </td>
      <td className="px-5 py-3.5">
        <p className="flex items-center gap-2 font-medium text-foreground">
          <Icon className={cn("size-4 shrink-0", entry.event === "auth.login_failed" ? "text-danger" : "text-brand-500")} />
          {entry.description}
          {subject.length > 0 && <span className="font-normal text-muted">#{subject.map(([, value]) => value).join(" / ")}</span>}
        </p>
        {fields.length > 0 && <p className="mt-1 text-xs text-muted">Fields: {fields.join(", ")}</p>}
      </td>
      <td className="px-5 py-3.5">
        {entry.event === "auth.login_failed" ? (
          <Badge tone="danger">Wrong password</Badge>
        ) : entry.succeeded ? (
          <Badge tone="success">Done</Badge>
        ) : (
          <Badge tone="warning">{entry.status === 422 ? "Rejected" : entry.status === 403 ? "Not allowed" : `Failed (${entry.status})`}</Badge>
        )}
      </td>
      <td className="px-5 py-3.5 text-xs text-muted">
        <p className="font-medium text-foreground">{entry.ip ?? "—"}</p>
        <p title={entry.user_agent ?? undefined}>{describeDevice(entry.user_agent)}</p>
      </td>
    </tr>
  );
}

/** "Chrome on Windows" from a user agent string; good enough to spot an unfamiliar device. */
function describeDevice(agent: string | null): string {
  if (!agent) return "";
  const browser = /Edg\//.test(agent) ? "Edge" : /OPR\//.test(agent) ? "Opera" : /Chrome\//.test(agent) ? "Chrome" : /Firefox\//.test(agent) ? "Firefox" : /Safari\//.test(agent) ? "Safari" : /node|undici/i.test(agent) ? "Website server" : "Browser";
  const system = /iPhone|iPad/.test(agent) ? "iPhone or iPad" : /Android/.test(agent) ? "Android" : /Windows/.test(agent) ? "Windows" : /Mac OS X/.test(agent) ? "Mac" : /Linux/.test(agent) ? "Linux" : "";
  return system ? `${browser} on ${system}` : browser;
}

function PageLink({ href, disabled, label, children }: { href: string; disabled: boolean; label: string; children: React.ReactNode }) {
  const classes = buttonClasses({ variant: "outline", size: "icon", className: cn("size-9", disabled && "pointer-events-none opacity-40") });
  return disabled ? (
    <span className={classes} aria-disabled aria-label={label}>
      {children}
    </span>
  ) : (
    <Link href={href} className={classes} aria-label={label}>
      {children}
    </Link>
  );
}

function TableSkeleton() {
  return (
    <Card className="space-y-4 p-5" aria-busy>
      <Skeleton className="h-10 w-full rounded-xl" />
      {Array.from({ length: 8 }, (_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </Card>
  );
}
