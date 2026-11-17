import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, LayoutList, Search } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { BookingTable } from "@/components/admin/bookings/booking-table";
import { CheckInBox } from "@/components/admin/bookings/check-in-box";
import { DayTimeline } from "@/components/admin/bookings/day-timeline";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { can, requireStaff } from "@/lib/session";
import type { AdminBookingDay, Booking, Paginated } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Bookings" };

/** Adds days to a YYYY-MM-DD date. */
function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** The table's filters. "action" is anything waiting on staff: a request to approve or a transfer to check. */
const filters = {
  all: { label: "All", query: {} },
  action: { label: "Needs action", query: { needs_action: "1" } },
  held: { label: "Awaiting payment", query: { status: "held" } },
  confirmed: { label: "Confirmed", query: { status: "confirmed" } },
  checked_in: { label: "Checked in", query: { status: "checked_in" } },
  completed: { label: "Completed", query: { status: "completed" } },
  cancelled: { label: "Cancelled", query: { status: "cancelled,expired" } },
} satisfies Record<string, { label: string; query: Record<string, string> }>;

type Filter = keyof typeof filters;

type Query = Awaited<PageProps<"/admin/bookings">["searchParams"]>;

const text = (query: Query, key: string) => (typeof query[key] === "string" ? (query[key] as string) : "");

export default function BookingsAdminPage({ searchParams }: PageProps<"/admin/bookings">) {
  return (
    <>
      <PageHeader title="Bookings" description="Today's arrivals, check-in, approvals and every booking." />
      <div className="space-y-6">
        <Suspense fallback={<CheckInBox />}>
          {searchParams.then((query) => (
            <CheckInBox initialCode={text(query, "checkin")} />
          ))}
        </Suspense>
        <Suspense fallback={<Skeleton className="h-[480px] rounded-2xl" />}>
          {searchParams.then((query) => (
            <Bookings query={query} />
          ))}
        </Suspense>
      </div>
    </>
  );
}

async function Bookings({ query }: { query: Query }) {
  // Front desk check people in; operations managers run bookings. Either can open this page.
  const staff = await requireStaff();
  if (!can(staff, "bookings.manage") && !can(staff, "bookings.checkin")) redirect("/admin?denied=1");
  const canManage = can(staff, "bookings.manage");

  const view = text(query, "view") === "table" ? "table" : "calendar";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text(query, "date")) ? text(query, "date") : null;
  const search = text(query, "search");
  const filter: Filter = text(query, "filter") in filters ? (text(query, "filter") as Filter) : "all";
  const page = Math.max(1, Number(text(query, "page")) || 1);

  const day = await api<AdminBookingDay>(`/admin/bookings/day${date ? `?date=${encodeURIComponent(date)}` : ""}`);
  const needsAction = day.counts.awaiting_approval + day.counts.transfers_to_check;

  /** Builds a link to this page, keeping the view and anything not overridden. */
  const link = (patch: Record<string, string>) => {
    const next = new URLSearchParams({
      ...(view === "table" && { view }),
      ...(date && { date }),
      ...(search && { search }),
      ...(view === "table" && filter !== "all" && { filter }),
      ...patch,
    });
    [...next.entries()].forEach(([key, value]) => !value && next.delete(key));
    const qs = next.toString();
    return (qs ? `/admin/bookings?${qs}` : "/admin/bookings") as "/admin/bookings";
  };

  const label = new Intl.DateTimeFormat("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${day.date}T12:00:00Z`));
  const tiles = [
    { label: date ? "Bookings" : "Bookings today", value: day.counts.bookings, href: link({ view: "", filter: "", search: "", page: "" }) },
    { label: "Still to arrive", value: day.counts.arrivals, href: link({ view: "", filter: "", search: "", page: "" }) },
    { label: "Checked in", value: day.counts.checked_in, href: link({ view: "", filter: "", search: "", page: "" }) },
    {
      label: "Needs your action",
      value: needsAction,
      detail: needsAction > 0 ? [day.counts.awaiting_approval > 0 && `${day.counts.awaiting_approval} to approve`, day.counts.transfers_to_check > 0 && `${day.counts.transfers_to_check} transfer${day.counts.transfers_to_check === 1 ? "" : "s"} to check`].filter(Boolean).join(" · ") : null,
      href: link({ view: "table", filter: "action", date: "", search: "", page: "" }),
      highlight: needsAction > 0,
    },
  ];

  // The table lists every booking (newest first) unless a day is picked; the calendar always shows one day.
  const listQuery = new URLSearchParams(view === "table" ? filters[filter].query : {});
  if (view === "calendar" && !search) listQuery.set("date", day.date);
  if (view === "table" && date) listQuery.set("date", date);
  if (search) listQuery.set("search", search);
  if (page > 1) listQuery.set("page", String(page));
  const { data: bookings, meta } = await api<Paginated<Booking>>(`/admin/bookings?${listQuery}`);

  const viewSwitch = (
    <div className="inline-flex rounded-xl border border-border bg-surface p-1" role="tablist" aria-label="Bookings view">
      {([["calendar", "Calendar", CalendarDays], ["table", "Table", LayoutList]] as const).map(([key, title, Icon]) => (
        <Link
          key={key}
          href={link({ view: key === "table" ? "table" : "", filter: "", page: "" })}
          role="tab"
          aria-selected={view === key}
          className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition", view === key ? "bg-navy-900 text-white dark:bg-navy-700" : "text-muted hover:text-foreground")}
        >
          <Icon className="size-4" /> {title}
        </Link>
      ))}
    </div>
  );

  const searchBox = (
    <form className="relative" action="/admin/bookings">
      {view === "table" && <input type="hidden" name="view" value="table" />}
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
      <input
        name="search"
        defaultValue={search}
        placeholder="Reference, name, email or code"
        className="h-10 w-full rounded-xl border border-border bg-surface pl-9 pr-3 text-sm text-foreground sm:w-72"
      />
    </form>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Link key={tile.label} href={tile.href} className={cn("rounded-2xl border bg-surface p-4 transition hover:border-brand-500/50", tile.highlight ? "border-info bg-info-soft/40" : "border-border")}>
            <p className="text-sm text-muted">{tile.label}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{tile.value}</p>
            {tile.detail && <p className="mt-0.5 text-xs font-semibold text-info">{tile.detail}</p>}
          </Link>
        ))}
      </div>

      {view === "calendar" ? (
        <>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <ButtonLink href={link({ date: shiftDate(day.date, -1), search: "" })} variant="outline" size="icon" aria-label="Previous day">
                <ChevronLeft className="size-4" />
              </ButtonLink>
              <p className="flex items-center gap-2 text-lg font-bold text-foreground">
                <CalendarDays className="size-5 text-brand-500" /> {label}
              </p>
              <ButtonLink href={link({ date: shiftDate(day.date, 1), search: "" })} variant="outline" size="icon" aria-label="Next day">
                <ChevronRight className="size-4" />
              </ButtonLink>
              {date && (
                <Link href="/admin/bookings" className="ml-2 text-sm font-semibold text-brand-600 hover:underline">
                  Today
                </Link>
              )}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {viewSwitch}
              {searchBox}
            </div>
          </div>
          <DayTimeline day={day} />
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {viewSwitch}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <form action="/admin/bookings" className="flex items-center gap-2">
                <input type="hidden" name="view" value="table" />
                {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
                {search && <input type="hidden" name="search" value={search} />}
                <label className="sr-only" htmlFor="booking-date">Only bookings on</label>
                <input id="booking-date" type="date" name="date" defaultValue={date ?? ""} className="h-10 rounded-xl border border-border bg-surface px-3 text-sm text-foreground" />
                <button type="submit" className="h-10 rounded-xl border border-border bg-surface px-3 text-sm font-semibold text-foreground hover:bg-surface-muted">Go</button>
                {date && <Link href={link({ date: "", page: "" })} className="text-sm font-semibold text-brand-600 hover:underline">Any date</Link>}
              </form>
              {searchBox}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(filters) as Filter[]).map((key) => (
              <Link
                key={key}
                href={link({ filter: key === "all" ? "" : key, page: "" })}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition",
                  filter === key ? "border-brand-500 bg-brand-500 text-white" : "border-border bg-surface text-muted hover:text-foreground",
                )}
              >
                {filters[key].label}
                {key === "action" && needsAction > 0 && <span className={cn("rounded-md px-1.5 text-xs", filter === key ? "bg-white/20" : "bg-info-soft text-info")}>{needsAction}</span>}
              </Link>
            ))}
          </div>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 className="font-semibold text-foreground">
            {search ? `Results for “${search}”` : view === "calendar" ? `Bookings on ${label}` : filter === "action" ? "Waiting for you" : date ? `${filters[filter].label} on ${label}` : `${filters[filter].label} bookings`}
          </h2>
          {meta.total > 0 && <p className="text-sm text-muted">{meta.total} booking{meta.total === 1 ? "" : "s"}</p>}
        </div>
        {bookings.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={filter === "action" && view === "table" ? "All caught up" : "No bookings here"}
            description={search ? "Nothing matches that search." : filter === "action" && view === "table" ? "No requests to approve and no transfers to check." : view === "calendar" ? "Nothing booked for this day yet." : "Try another filter or date."}
            className="py-14"
          />
        ) : (
          <BookingTable bookings={bookings} canManage={canManage} />
        )}
        {meta.last_page > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 text-sm">
            <span className="text-muted">Page {meta.current_page} of {meta.last_page}</span>
            <div className="flex gap-2">
              {meta.current_page > 1 && <ButtonLink href={link({ page: String(meta.current_page - 1) })} variant="outline" size="sm">Previous</ButtonLink>}
              {meta.current_page < meta.last_page && <ButtonLink href={link({ page: String(meta.current_page + 1) })} variant="outline" size="sm">Next</ButtonLink>}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
