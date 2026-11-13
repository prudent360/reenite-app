"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Activity, AlertTriangle, CircleCheck, Clock, Hourglass, MapPin, RefreshCw, Search, SquareCheckBig, Users, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { DotLoader } from "@/components/ui/loader";
import { checkInBooking, endSession } from "@/lib/actions/bookings";
import { BOOKING_TIMEZONE, formatBookingTime } from "@/lib/booking-format";
import type { MonitorSession, SessionMonitor } from "@/lib/types";
import { cn } from "@/lib/utils";

type Filter = "all" | "active" | "ending_soon" | "not_arrived" | "upcoming" | "checked_in";

const shortDate = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", timeZone: BOOKING_TIMEZONE });
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: BOOKING_TIMEZONE });

/** The page reloads its data this often, and the countdowns tick between reloads. */
const REFRESH_MS = 60_000;
const TICK_MS = 15_000;

const matches: Record<Filter, (session: MonitorSession) => boolean> = {
  all: () => true,
  active: (session) => session.phase === "active",
  ending_soon: (session) => session.ending_soon,
  not_arrived: (session) => session.not_arrived,
  upcoming: (session) => session.phase === "upcoming",
  checked_in: (session) => session.phase === "active" && session.status === "checked_in",
};

/**
 * Live view of everyone in a space now and everyone still due today. Sessions end by themselves
 * at their end time (customers are warned shortly before and told when it ends); staff can end
 * one early or check someone in from here.
 */
export function SessionMonitorView({ data, canManage }: { data: SessionMonitor; canManage: boolean }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [refreshing, startRefresh] = useTransition();

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), TICK_MS);
    const reload = window.setInterval(() => startRefresh(() => router.refresh()), REFRESH_MS);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(reload);
    };
  }, [router]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.sessions.filter(
      (session) =>
        matches[filter](session) &&
        (!term || [session.customer.name, session.customer.email, session.customer.phone ?? "", session.space_name, session.reference, session.seat_labels].some((value) => value.toLowerCase().includes(term))),
    );
  }, [data.sessions, filter, search]);

  const tiles: { key: Filter; label: string; value: number; icon: LucideIcon; tone: string }[] = [
    { key: "active", label: "In session now", value: data.counts.active, icon: Activity, tone: "bg-success-soft text-success" },
    { key: "ending_soon", label: "Ending soon", value: data.counts.ending_soon, icon: Clock, tone: "bg-warning-soft text-warning" },
    { key: "not_arrived", label: "Not arrived", value: data.counts.not_arrived, icon: AlertTriangle, tone: "bg-danger-soft text-danger" },
    { key: "upcoming", label: "Still due today", value: data.counts.upcoming, icon: Hourglass, tone: "bg-info-soft text-info" },
    { key: "checked_in", label: "Checked in", value: data.counts.checked_in, icon: CircleCheck, tone: "bg-brand-500/10 text-brand-600" },
  ];

  const chips: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "In session" },
    { key: "ending_soon", label: "Ending soon" },
    { key: "not_arrived", label: "Not arrived" },
    { key: "upcoming", label: "Due today" },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between lg:mb-8">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-foreground sm:text-3xl">
            <Activity className="size-7 text-brand-500" /> Session monitor
          </h1>
          <p className="mt-1.5 text-muted">Who&apos;s in, who&apos;s finishing and who&apos;s still due today. Updates every minute.</p>
        </div>
        <Button variant="outline" onClick={() => startRefresh(() => router.refresh())} disabled={refreshing}>
          <RefreshCw className={cn("size-4", refreshing && "animate-spin")} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        {tiles.map((tile) => (
          <button
            key={tile.key}
            type="button"
            onClick={() => setFilter(filter === tile.key ? "all" : tile.key)}
            aria-pressed={filter === tile.key}
            className={cn(
              "flex items-center gap-3 rounded-2xl border bg-surface p-4 text-left shadow-card transition hover:border-brand-500/40 sm:p-5",
              filter === tile.key ? "border-brand-500 ring-2 ring-brand-500/20" : "border-border",
              tile.key === "checked_in" && "col-span-2 lg:col-span-1",
            )}
          >
            <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", tile.tone)}>
              <tile.icon className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-2xl font-extrabold leading-none text-foreground">{tile.value}</span>
              <span className="mt-1 block truncate text-sm text-muted">{tile.label}</span>
            </span>
          </button>
        ))}
      </div>

      <Card className="mt-5 flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search sessions</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by customer, phone, space, seat or reference"
            className="h-10 w-full rounded-xl border border-border bg-surface pl-10 pr-3 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
          />
        </label>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:pb-0">
          {chips.map((chip) => {
            const count = data.sessions.filter(matches[chip.key]).length;
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => setFilter(chip.key)}
                aria-pressed={filter === chip.key}
                className={cn(
                  "h-9 shrink-0 rounded-xl px-3.5 text-sm font-semibold transition-colors",
                  filter === chip.key ? "bg-brand-500 text-white" : "bg-surface-muted text-muted hover:text-foreground",
                )}
              >
                {chip.label} <span className={filter === chip.key ? "text-white/80" : "text-muted"}>({count})</span>
              </button>
            );
          })}
        </div>
      </Card>

      {visible.length === 0 ? (
        <Card className="mt-5">
          <EmptyState
            icon={Users}
            title={data.sessions.length === 0 ? "Nobody in a space right now" : "No sessions match"}
            description={data.sessions.length === 0 ? "Bookings in progress and the rest of today's arrivals show here." : "Try another filter or search."}
          />
        </Card>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((session) => (
            <SessionCard key={session.reference} session={session} now={now} canManage={canManage} />
          ))}
        </div>
      )}
    </div>
  );
}

function SessionCard({ session, now, canManage }: { session: MonitorSession; now: number; canManage: boolean }) {
  const [pending, startTransition] = useTransition();
  const start = new Date(session.starts_at).getTime();
  const end = new Date(session.ends_at).getTime();
  const active = session.phase === "active";
  const progress = active ? Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100))) : 0;

  const state = session.not_arrived
    ? { label: "Not arrived", pill: "bg-danger-soft text-danger", bar: "bg-danger", ring: "border-danger/40" }
    : session.ending_soon
      ? { label: "Ending soon", pill: "bg-warning-soft text-warning", bar: "bg-warning", ring: "border-warning/50" }
      : active
        ? { label: "In session", pill: "bg-success-soft text-success", bar: "bg-success", ring: "border-success/30" }
        : { label: "Due today", pill: "bg-info-soft text-info", bar: "bg-info", ring: "border-border" };

  function run(action: () => Promise<{ ok?: boolean; message?: string }>, fallback: string) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(result.message);
      else toast.error(result.message ?? fallback);
    });
  }

  function finish() {
    if (!window.confirm(`End ${session.customer.name}'s session now? The rest of the time is freed up and they'll get a "session ended" message.`)) return;
    run(() => endSession(session.reference), "Couldn't end this session.");
  }

  return (
    <Card className={cn("flex flex-col p-5", state.ring)}>
      <div className="flex items-start gap-3">
        <Avatar name={session.customer.name} className="size-11" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-foreground">{session.customer.name}</p>
          <p className="flex items-center gap-1 truncate text-sm text-muted">
            <MapPin className="size-3.5 shrink-0" /> <span className="truncate">{session.space_name} · {session.location_name}</span>
          </p>
        </div>
        <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", state.pill)}>
          <span className="size-1.5 rounded-full bg-current" /> {state.label}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5 text-xs font-medium">
        <span className="rounded-lg bg-surface-muted px-2 py-1 text-muted">{session.length_label}</span>
        {session.seat_labels && <span className="rounded-lg bg-surface-muted px-2 py-1 text-muted">{session.seat_labels}</span>}
        {session.people > 1 && <span className="rounded-lg bg-surface-muted px-2 py-1 text-muted">{session.people} people</span>}
        {session.checked_in_at && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-success-soft px-2 py-1 text-success">
            <SquareCheckBig className="size-3.5" /> Checked in {formatBookingTime(session.checked_in_at)}
          </span>
        )}
      </div>

      <div className="mt-4">
        <div className="h-2 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Time used">
          <div className={cn("h-full rounded-full transition-[width] duration-500", state.bar)} style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 text-sm">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <Clock className="size-4 text-muted" />
            {active ? `${duration(end - now)} left · ends ${endLabel(session.ends_at, now)}` : `Starts ${formatBookingTime(session.starts_at)} · in ${duration(start - now)}`}
          </span>
          {active && <span className="text-xs text-muted">{progress}%</span>}
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        <Link href={`/admin/bookings/${session.reference}`} className={buttonClasses({ variant: "outline", size: "sm", className: "flex-1" })}>
          View
        </Link>
        {session.can_check_in && (
          <Button size="sm" variant={active ? "primary" : "navy"} className="flex-1" disabled={pending} onClick={() => run(() => checkInBooking(session.reference), "Couldn't check in.")}>
            {pending ? <DotLoader className="text-current" label="Working" /> : "Check in"}
          </Button>
        )}
        {canManage && active && (
          <Button size="sm" variant={session.can_check_in ? "outline" : "primary"} className="flex-1" disabled={pending} onClick={finish}>
            {pending ? <DotLoader className="text-current" label="Ending" /> : (
              <>
                <CircleCheck className="size-4" /> End now
              </>
            )}
          </Button>
        )}
      </div>
    </Card>
  );
}

/** "4d 7h", "2h 15m", "12m". */
function duration(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

/** "5:00pm" today, otherwise "17 Nov". */
function endLabel(iso: string, now: number): string {
  return dayKey.format(new Date(iso)) === dayKey.format(new Date(now)) ? formatBookingTime(iso) : shortDate.format(new Date(iso));
}
