"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { CalendarPlus, CircleCheck, DoorOpen, Hourglass, Plus, Radio, Sparkles, Timer } from "lucide-react";
import { getAvailability } from "@/lib/actions/bookings";
import { BOOKING_TIMEZONE } from "@/lib/booking-format";
import type { Booking } from "@/lib/types";
import { buttonClasses } from "@/components/ui/button";
import { DotLoader } from "@/components/ui/loader";
import { cn } from "@/lib/utils";

/* ---------- A shared clock: one timer for every countdown on the page ---------- */

let current = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    current = Date.now();
    timer = setInterval(() => {
      current = Date.now();
      listeners.forEach((notify) => notify());
    }, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/** Milliseconds now, ticking each second; null while rendering on the server. */
export function useNow(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => current || (current = Date.now()),
    () => null,
  );
}

/* ---------- Formatting ---------- */

const clock = new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: BOOKING_TIMEZONE });
const dayAndClock = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: BOOKING_TIMEZONE });
const hhmm = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: BOOKING_TIMEZONE });
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: BOOKING_TIMEZONE });

const time = (ms: number) => clock.format(ms).replace(/\s/g, "").toLowerCase();

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return { days: Math.floor(total / 86400), hours: Math.floor((total % 86400) / 3600), minutes: Math.floor((total % 3600) / 60), seconds: total % 60 };
}

/** "2d 4h", "1h 12m", "8m 30s" */
export function shortDuration(ms: number): string {
  const { days, hours, minutes, seconds } = parts(ms);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
}

const CHECK_IN_OPENS_MS = 2 * 60 * 60 * 1000;
const ENDING_SOON_MS = 15 * 60 * 1000;

type Phase = "upcoming" | "live" | "ended";

function phaseOf(booking: Pick<Booking, "starts_at" | "ends_at">, now: number): Phase {
  if (now < Date.parse(booking.starts_at)) return "upcoming";
  if (now < Date.parse(booking.ends_at)) return "live";
  return "ended";
}

const tracked = (booking: Booking) => ["confirmed", "checked_in", "completed"].includes(booking.status);

/* ---------- Full tracker, on the booking page ---------- */

/**
 * Where the booking is right now: a countdown to the start, then a live progress bar with the
 * time left, then a "book again" prompt. Ticks every second without reloading the page.
 */
export function BookingTracker({ booking, bookHref }: { booking: Booking; bookHref: string }) {
  const now = useNow();
  if (!tracked(booking)) return null;

  if (now === null) {
    return <div className="h-44 animate-pulse rounded-2xl border border-border bg-surface" aria-hidden />;
  }

  const phase = phaseOf(booking, now);
  return (
    <section aria-label="Booking tracker" className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
      {phase === "upcoming" && <Upcoming booking={booking} now={now} />}
      {phase === "live" && <Live booking={booking} now={now} bookHref={bookHref} />}
      {phase === "ended" && <Ended booking={booking} now={now} bookHref={bookHref} />}
    </section>
  );
}

function Upcoming({ booking, now }: { booking: Booking; now: number }) {
  const start = Date.parse(booking.starts_at);
  const checkInOpens = start - CHECK_IN_OPENS_MS;
  const checkInOpen = now >= checkInOpens;
  const left = parts(start - now);
  const soon = start - now < 24 * 60 * 60 * 1000;

  const steps = [
    { label: "Booked", detail: "Confirmed", done: true },
    { label: "Check-in", detail: checkInOpen ? "Open now" : `Opens ${soon ? time(checkInOpens) : dayAndClock.format(checkInOpens)}`, done: checkInOpen, active: checkInOpen },
    { label: "Session", detail: time(start), done: false },
    { label: "Done", detail: time(Date.parse(booking.ends_at)), done: false },
  ];

  return (
    <div className="p-6 sm:p-8">
      <p className="flex items-center gap-2 text-sm font-semibold text-muted">
        <Timer className="size-4 text-brand-500" /> Starts in
      </p>
      <div className="mt-3 flex items-end gap-2 sm:gap-3" role="timer" aria-live="off" aria-label={`Starts in ${shortDuration(start - now)}`}>
        {(left.days > 0 ? [[left.days, "days"], [left.hours, "hrs"], [left.minutes, "min"]] : [[left.hours, "hrs"], [left.minutes, "min"], [left.seconds, "sec"]]).map(([value, unit]) => (
          <div key={unit} className="min-w-16 rounded-xl bg-navy-900 px-3 py-2.5 text-center text-white dark:bg-navy-800 sm:min-w-20">
            <span className="block font-mono text-3xl font-bold tabular-nums sm:text-4xl">{String(value).padStart(2, "0")}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/60">{unit}</span>
          </div>
        ))}
      </div>

      <ol className="mt-7 grid grid-cols-4 gap-2" aria-label="Booking progress">
        {steps.map((step) => (
          <li key={step.label} className="min-w-0">
            <span className={cn("block h-1.5 rounded-full", step.done ? "bg-success" : "bg-surface-muted", step.active && "animate-pulse")} />
            <span className={cn("mt-2 block truncate text-xs font-semibold", step.done ? "text-foreground" : "text-muted")}>{step.label}</span>
            <span className="block truncate text-[11px] text-muted">{step.detail}</span>
          </li>
        ))}
      </ol>

      <p className={cn("mt-5 flex items-start gap-2 rounded-xl px-4 py-3 text-sm", checkInOpen ? "bg-success-soft text-foreground" : "bg-surface-muted text-muted")}>
        {checkInOpen ? <DoorOpen className="mt-0.5 size-4 shrink-0 text-success" /> : <Hourglass className="mt-0.5 size-4 shrink-0" />}
        <span>
          {checkInOpen
            ? `Check-in is open. Show code ${booking.check_in_code ?? "on your pass"} at the front desk when you arrive.`
            : `Check-in opens 2 hours before, at ${time(checkInOpens)}${soon ? "" : ` on ${dayAndClock.format(checkInOpens).split(",")[0]}`}.`}
        </span>
      </p>
    </div>
  );
}

function Live({ booking, now, bookHref }: { booking: Booking; now: number; bookHref: string }) {
  const start = Date.parse(booking.starts_at);
  const end = Date.parse(booking.ends_at);
  const remaining = end - now;
  const percent = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
  const endingSoon = remaining <= ENDING_SOON_MS;
  const multiDay = booking.rate_unit !== "hour";
  const totalDays = Math.max(1, Math.round((end - start) / 86_400_000));
  const dayNumber = Math.min(totalDays, Math.floor((now - start) / 86_400_000) + 1);

  return (
    <div className="p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-success">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-success" />
          </span>
          {multiDay && totalDays > 1 ? `Live now · day ${dayNumber} of ${totalDays}` : "Live now"}
        </p>
        <p className="text-sm text-muted">
          {booking.checked_in_at ? (
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <CircleCheck className="size-4 text-success" /> Checked in at {time(Date.parse(booking.checked_in_at))}
            </span>
          ) : (
            <span className="font-medium text-warning">Not checked in yet: show code {booking.check_in_code} at the desk</span>
          )}
        </p>
      </div>

      <p className={cn("mt-4 text-4xl font-bold tabular-nums tracking-tight sm:text-5xl", endingSoon ? "text-warning" : "text-foreground")} role="timer" aria-label={`${shortDuration(remaining)} left`}>
        {shortDuration(remaining)} <span className="text-lg font-semibold text-muted">left</span>
      </p>

      <div className="mt-5">
        <div
          className="relative h-3 overflow-hidden rounded-full bg-surface-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(percent)}
          aria-label="Session progress"
        >
          <div
            className={cn("h-full rounded-full transition-[width] duration-1000 ease-linear", endingSoon ? "bg-warning" : "bg-gradient-to-r from-success to-brand-500")}
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs font-medium text-muted">
          <span>{multiDay ? dayAndClock.format(start) : time(start)}</span>
          <span>{Math.round(percent)}% done</span>
          <span>Ends {multiDay ? dayAndClock.format(end) : time(end)}</span>
        </div>
      </div>

      {booking.rate_unit === "hour" && booking.space?.slug && <MoreTime booking={booking} endingSoon={endingSoon} bookHref={bookHref} />}
    </div>
  );
}

/**
 * Checks whether the space is free right after this booking, and offers to book the extra time
 * straight from the end of the session.
 */
function MoreTime({ booking, endingSoon, bookHref }: { booking: Booking; endingSoon: boolean; bookHref: string }) {
  const [checked, setChecked] = useState<{ minutes: number } | null>(null);
  const [pending, startTransition] = useTransition();
  const end = Date.parse(booking.ends_at);
  const endTime = hhmm.format(end);
  const date = dayKey.format(end);

  function check() {
    startTransition(async () => {
      const result = await getAvailability(booking.space!.slug, date, booking.seats);
      const start = result.ok ? result.data?.starts.find((option) => option.time === endTime) : undefined;
      setChecked({ minutes: start?.max_minutes ?? 0 });
    });
  }

  const extendLink = (hours: number) => `${bookHref}?${new URLSearchParams({ date, start: endTime, unit: "hour", qty: String(hours) })}`;

  return (
    <div className={cn("mt-6 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center", endingSoon ? "border-warning/40 bg-warning-soft" : "border-border")}>
      <p className="flex-1 text-sm text-foreground">
        <span className="font-semibold">{endingSoon ? "Almost time." : "Enjoying it?"}</span>{" "}
        {checked === null
          ? "Need more time? We can check if the space is free after you."
          : checked.minutes >= 60
            ? `Good news: it's free until ${time(end + checked.minutes * 60_000)}.`
            : "We can't book straight on from your session online. Ask the front desk: they can extend it if the space is free."}
      </p>
      {checked === null ? (
        <button type="button" onClick={check} disabled={pending} className={buttonClasses({ variant: "outline", size: "sm" })}>
          {pending ? <DotLoader className="text-current" label="Checking" /> : <><Timer className="size-4" /> Need more time?</>}
        </button>
      ) : checked.minutes >= 60 ? (
        <div className="flex gap-2">
          <Link href={extendLink(1)} className={buttonClasses({ size: "sm" })}>
            <Plus className="size-4" /> 1 hour
          </Link>
          {checked.minutes >= 120 && (
            <Link href={extendLink(2)} className={buttonClasses({ variant: "outline", size: "sm" })}>
              2 hours
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Ended({ booking, now, bookHref }: { booking: Booking; now: number; bookHref: string }) {
  const ago = now - Date.parse(booking.ends_at);
  return (
    <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:p-8">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
        <Sparkles className="size-6" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground">That&apos;s a wrap</p>
        <p className="text-sm text-muted">
          Your session ended {ago < 60_000 ? "just now" : `${shortDuration(ago).split(" ")[0]} ago`}. Thanks for working with us.
        </p>
        <div className="mt-3 h-1.5 rounded-full bg-success" aria-hidden />
      </div>
      {booking.space?.slug && (
        <Link href={bookHref} className={buttonClasses({ variant: "outline", size: "sm" })}>
          <CalendarPlus className="size-4" /> Book again
        </Link>
      )}
    </div>
  );
}

/* ---------- Compact status, for lists and the dashboard ---------- */

/** "Starts in 2h 14m", "Live · 48m left" or "Ended", ticking. */
export function BookingCountdownChip({ booking, className }: { booking: Pick<Booking, "starts_at" | "ends_at" | "status">; className?: string }) {
  const now = useNow();
  if (now === null || !["confirmed", "checked_in"].includes(booking.status)) return null;
  const phase = phaseOf(booking, now);
  if (phase === "ended") return null;

  const live = phase === "live";
  const ms = live ? Date.parse(booking.ends_at) - now : Date.parse(booking.starts_at) - now;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
        live ? "bg-success-soft text-success" : "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300",
        className,
      )}
    >
      {live ? <Radio className="size-3.5 animate-pulse" /> : <Timer className="size-3.5" />}
      {live ? `Live · ${shortDuration(ms)} left` : `Starts in ${shortDuration(ms)}`}
    </span>
  );
}
