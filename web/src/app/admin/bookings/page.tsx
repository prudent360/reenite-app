import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { CheckInBox } from "@/components/admin/bookings/check-in-box";
import { DayTimeline } from "@/components/admin/bookings/day-timeline";
import { BookingStatusBadge } from "@/components/booking/booking-parts";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { formatWhen } from "@/lib/booking-format";
import { can, requireStaff } from "@/lib/session";
import type { AdminBookingDay, Booking, Paginated } from "@/lib/types";
import { cn, formatNaira } from "@/lib/utils";

export const metadata: Metadata = { title: "Bookings" };

/** Adds days to a YYYY-MM-DD date. */
function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export default function BookingsAdminPage({ searchParams }: PageProps<"/admin/bookings">) {
  return (
    <>
      <PageHeader title="Bookings" description="Today's arrivals, check-in, approvals and every booking." />
      <div className="space-y-6">
        <Suspense fallback={<CheckInBox />}>
          {searchParams.then((query) => (
            <CheckInBox initialCode={typeof query.checkin === "string" ? query.checkin : ""} />
          ))}
        </Suspense>
        <Suspense fallback={<Skeleton className="h-[480px] rounded-2xl" />}>
          {searchParams.then((query) => (
            <Bookings
              date={typeof query.date === "string" ? query.date : null}
              status={typeof query.status === "string" ? query.status : null}
              search={typeof query.search === "string" ? query.search : null}
            />
          ))}
        </Suspense>
      </div>
    </>
  );
}

async function Bookings({ date, status, search }: { date: string | null; status: string | null; search: string | null }) {
  // Front desk check people in; operations managers run bookings. Either can open this page.
  const staff = await requireStaff();
  if (!can(staff, "bookings.manage") && !can(staff, "bookings.checkin")) redirect("/admin?denied=1");
  const day = await api<AdminBookingDay>(`/admin/bookings/day${date ? `?date=${encodeURIComponent(date)}` : ""}`);
  const listQuery = new URLSearchParams();
  if (status) listQuery.set("status", status);
  else if (!search) listQuery.set("date", day.date);
  if (search) listQuery.set("search", search);
  const { data: bookings } = await api<Paginated<Booking>>(`/admin/bookings?${listQuery}`);

  const label = new Intl.DateTimeFormat("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${day.date}T12:00:00Z`));
  const tiles = [
    { label: "Bookings", value: day.counts.bookings, href: `/admin/bookings?date=${day.date}` },
    { label: "Still to arrive", value: day.counts.arrivals, href: `/admin/bookings?date=${day.date}` },
    { label: "Checked in", value: day.counts.checked_in, href: `/admin/bookings?date=${day.date}` },
    { label: "Awaiting approval", value: day.counts.awaiting_approval, href: "/admin/bookings?status=pending_approval", highlight: day.counts.awaiting_approval > 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <ButtonLink href={`/admin/bookings?date=${shiftDate(day.date, -1)}`} variant="outline" size="icon" aria-label="Previous day">
            <ChevronLeft className="size-4" />
          </ButtonLink>
          <p className="flex items-center gap-2 text-lg font-bold text-foreground">
            <CalendarDays className="size-5 text-brand-500" /> {label}
          </p>
          <ButtonLink href={`/admin/bookings?date=${shiftDate(day.date, 1)}`} variant="outline" size="icon" aria-label="Next day">
            <ChevronRight className="size-4" />
          </ButtonLink>
          {date && (
            <Link href="/admin/bookings" className="ml-2 text-sm font-semibold text-brand-600 hover:underline">
              Today
            </Link>
          )}
        </div>
        <form className="relative" action="/admin/bookings">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            name="search"
            defaultValue={search ?? ""}
            placeholder="Reference, name, email or code"
            className="h-10 w-full rounded-xl border border-border bg-surface pl-9 pr-3 text-sm text-foreground sm:w-72"
          />
        </form>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Link key={tile.label} href={tile.href} className={cn("rounded-2xl border bg-surface p-4 transition hover:border-brand-500/50", tile.highlight ? "border-info" : "border-border")}>
            <p className="text-sm text-muted">{tile.label}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{tile.value}</p>
          </Link>
        ))}
      </div>

      <DayTimeline day={day} />

      <Card>
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-semibold text-foreground">
            {status === "pending_approval" ? "Waiting for approval" : search ? `Results for “${search}”` : `Bookings on ${label}`}
          </h2>
        </div>
        {bookings.length === 0 ? (
          <EmptyState icon={CalendarDays} title="No bookings here" description={search ? "Nothing matches that search." : "Nothing booked for this day yet."} className="py-14" />
        ) : (
          <ul className="divide-y divide-border">
            {bookings.map((booking) => (
              <li key={booking.reference}>
                <Link href={`/admin/bookings/${booking.reference}`} className="flex flex-col gap-2 px-5 py-4 transition hover:bg-surface-muted sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">{booking.customer?.name ?? "Customer"}</span>
                      {booking.customer?.is_guest && <span className="text-xs text-muted">Guest</span>}
                      <BookingStatusBadge booking={booking} />
                    </p>
                    <p className="mt-0.5 text-sm text-muted">
                      {booking.space_name} · {formatWhen(booking)} · {booking.seats} {booking.seats === 1 ? "person" : "people"}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="font-mono text-muted">{booking.reference}</span>
                    <span className="font-semibold text-foreground">{formatNaira(booking.invoice?.total ?? booking.total)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
