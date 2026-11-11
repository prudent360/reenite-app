import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarCheck2, ChevronRight, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { TimekeepingSettings } from "@/components/admin/appointments/timekeeping-settings";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { appointmentTone, formatAppointmentWhen, responseLabels } from "@/lib/appointment-format";
import { requireStaff } from "@/lib/session";
import type { Appointment, AppointmentSettings, Paginated } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Appointments" };

const tabs = [
  { key: "upcoming", label: "Upcoming" },
  { key: "attention", label: "Needs attention" },
  { key: "past", label: "Past" },
  { key: "cancelled", label: "Cancelled" },
  { key: "settings", label: "Timekeeping" },
] as const;

type Tab = (typeof tabs)[number]["key"];

export default function AppointmentsAdminPage({ searchParams }: PageProps<"/admin/appointments">) {
  return (
    <>
      <PageHeader
        title="Appointments"
        description="Meetings you book with clients. They get a confirmation and reminders, and can confirm or ask for another time."
        actions={
          <ButtonLink href="/admin/appointments/new">
            <Plus className="size-4" /> New appointment
          </ButtonLink>
        }
      />
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        {searchParams.then((query) => {
          const tab = tabs.some((option) => option.key === query.view) ? (query.view as Tab) : "upcoming";
          return <AppointmentsView tab={tab} search={typeof query.q === "string" ? query.q : ""} />;
        })}
      </Suspense>
    </>
  );
}

async function AppointmentsView({ tab, search }: { tab: Tab; search: string }) {
  await requireStaff("appointments.manage");

  const query = new URLSearchParams({ filter: tab === "settings" ? "upcoming" : tab });
  if (search) query.set("search", search);
  const [list, settings] = await Promise.all([
    api<Paginated<Appointment> & { counts: { today: number; attention: number } }>(`/admin/appointments?${query}`),
    tab === "settings" ? api<{ data: AppointmentSettings }>("/admin/appointments/settings") : null,
  ]);

  const nav = (
    <nav aria-label="Appointment sections" className="-mx-1 mb-6 flex gap-1 overflow-x-auto border-b border-border px-1">
      {tabs.map((option) => (
        <Link
          key={option.key}
          href={`/admin/appointments?view=${option.key}`}
          aria-current={tab === option.key ? "page" : undefined}
          className={cn(
            "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition-colors",
            tab === option.key ? "border-brand-500 text-foreground" : "border-transparent text-muted hover:text-foreground",
          )}
        >
          {option.label}
          {option.key === "attention" && list.counts.attention > 0 && <Badge tone="warning">{list.counts.attention}</Badge>}
        </Link>
      ))}
    </nav>
  );

  if (tab === "settings" && settings) {
    return (
      <>
        {nav}
        <TimekeepingSettings settings={settings.data} />
      </>
    );
  }

  const empty = {
    upcoming: { title: "No upcoming appointments", description: "Book one with New appointment. The client is sent the details straight away." },
    attention: { title: "Nothing needs attention", description: "Requests to reschedule, and finished appointments still to mark, show up here." },
    past: { title: "No past appointments yet", description: "Appointments appear here once you record how they went." },
    cancelled: { title: "No cancelled appointments", description: "" },
  }[tab as Exclude<Tab, "settings">];

  return (
    <>
      {nav}
      <Card className="overflow-hidden">
        <form className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:p-5">
          <input type="hidden" name="view" value={tab} />
          <label className="relative flex-1">
            <span className="sr-only">Search appointments</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              name="q"
              defaultValue={search}
              placeholder="Client, phone, email or reference"
              className="h-10 w-full rounded-xl border border-border bg-surface pl-10 pr-3 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
            />
          </label>
          <button type="submit" className={buttonClasses({ variant: "navy", size: "sm", className: "h-10" })}>
            Search
          </button>
        </form>
        {tab === "upcoming" && !search && list.counts.today > 0 && (
          <p className="border-b border-border bg-surface-muted/60 px-5 py-2.5 text-sm text-muted sm:px-6">
            {list.counts.today} {list.counts.today === 1 ? "appointment" : "appointments"} today.
          </p>
        )}
        {list.data.length === 0 ? (
          <EmptyState icon={CalendarCheck2} title={search ? "Nothing matches" : empty.title} description={search ? "Try a different name, number or reference." : empty.description} />
        ) : (
          <ul className="divide-y divide-border">
            {list.data.map((appointment) => (
              <li key={appointment.reference}>
                <Link href={`/admin/appointments/${appointment.reference}`} className="flex items-center gap-4 px-5 py-4 hover:bg-surface-muted/50 sm:px-6">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">{appointment.client?.name ?? "Client"}</span>
                      <span className="text-sm text-muted">{appointment.title}</span>
                      <Badge tone={appointmentTone(appointment)}>
                        {appointment.status === "scheduled" && appointment.response && new Date(appointment.ends_at) > new Date() ? responseLabels[appointment.response] : appointment.status_label}
                      </Badge>
                    </p>
                    <p className="mt-0.5 text-sm text-muted">
                      {formatAppointmentWhen(appointment)} · {appointment.mode_label}
                      {appointment.staff_name ? ` · with ${appointment.staff_name}` : ""}
                    </p>
                  </div>
                  <span className="hidden font-mono text-sm text-muted sm:block">{appointment.reference}</span>
                  <ChevronRight className="size-4 shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
