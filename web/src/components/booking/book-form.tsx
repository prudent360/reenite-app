"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, CalendarDays, Clock, Minus, Plus, ShieldCheck, Ticket, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Card, CardHeader } from "@/components/ui/card";
import { TextField, TextareaField } from "@/components/ui/form";
import { DotLoader } from "@/components/ui/loader";
import { createBooking, getAvailability, getQuote, getSeatMap, type BookingInput } from "@/lib/actions/bookings";
import { bookingToday, formatWhen, type BookingPreset } from "@/lib/booking-format";
import type { BookingQuote, DayAvailability, RateUnit, SeatMap, Space, User } from "@/lib/types";
import { cn, formatNaira } from "@/lib/utils";
import { formatMinutes, formatTime as formatClock, rateUnits } from "@/lib/workspace";

const maxQuantity: Record<RateUnit, number> = { hour: 12, day: 14, week: 8, month: 12 };
const unitLabel: Record<RateUnit, string> = { hour: "hour", day: "day", week: "week", month: "month" };

/** Fields that belong to the Time step; an error on one sends the customer back there. */
/** "13:30" -> 810 */
const clockMinutes = (time: string) => {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

const TIME_FIELDS = ["date", "start_time", "rate_unit", "quantity", "seats", "seat_ids", "addons"];

/**
 * Steps two and three of booking. "time": duration, date, start time, people and extras, priced
 * live (only free start times are offered). "details": who's booking, then hold and pay.
 * The summary on the side stays put across both, and state survives moving between them.
 */
export function BookForm({
  space,
  user,
  step,
  onNext,
  onBack,
  inDashboard = false,
  preset,
}: {
  space: Space;
  user: User | null;
  step: "time" | "details";
  onNext: () => void;
  onBack: () => void;
  /** Signed-in customers book inside their dashboard and land on its booking page. */
  inDashboard?: boolean;
  /** Starting values from a link ("Need more time?", "finish your booking"). */
  preset?: BookingPreset;
}) {
  const router = useRouter();
  const rates = (space.rates ?? []).filter((rate) => rate.is_active);
  const shared = space.type?.booking_mode === "shared";

  const [unit, setUnit] = useState<RateUnit>(() => (preset?.rate_unit && rates.some((rate) => rate.unit === preset.rate_unit) ? preset.rate_unit : (rates[0]?.unit ?? "hour")));
  const [quantity, setQuantity] = useState(() => preset?.quantity ?? (unit === "hour" ? Math.max(1, Math.round(space.min_duration_minutes / 60)) : 1));
  const [seats, setSeats] = useState(1);
  const [date, setDate] = useState(() => (preset?.date && preset.date >= bookingToday() ? preset.date : bookingToday()));
  const [startTime, setStartTime] = useState<string | null>(preset?.start_time ?? null);
  const [addons, setAddons] = useState<Record<number, number>>({});
  const [usePass, setUsePass] = useState(false);
  // Hot desks with named seats: "any free seat" unless the customer picks.
  const [seatMode, setSeatMode] = useState<"any" | "choose">("any");
  const [pickedSeats, setPickedSeats] = useState<number[]>([]);
  const [seatMap, setSeatMap] = useState<SeatMap | null>(null);
  const [loadingSeats, startSeats] = useTransition();
  const [details, setDetails] = useState({ name: "", email: "", phone: "", notes: "" });

  const [day, setDay] = useState<DayAvailability | null>(null);
  const [loadingDay, startDay] = useTransition();
  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [pricing, startPricing] = useTransition();
  const [submitting, startSubmit] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Free start times for the chosen day (for longer bookings, the first day).
  useEffect(() => {
    startDay(async () => {
      const result = await getAvailability(space.slug, date, seats);
      setDay(result.ok ? (result.data ?? null) : null);
    });
  }, [unit, date, seats, space.slug]);

  const hourly = unit === "hour";
  const shownDay = day;
  // Hourly: long enough for the hours chosen. Daily and longer: free from then until closing on the first day.
  const starts = useMemo(() => {
    const all = shownDay?.starts ?? [];
    if (hourly) return all.filter((start) => start.max_minutes >= quantity * 60);
    const closes = shownDay?.closes ? clockMinutes(shownDay.closes) : null;
    return closes === null ? [] : all.filter((start) => clockMinutes(start.time) + start.max_minutes >= closes);
  }, [shownDay, quantity, hourly]);
  // A time picked earlier stops counting once it no longer fits the duration or the day.
  // Daily and longer bookings start at the earliest free time until the customer picks another.
  const chosenStart = startTime && starts.some((start) => start.time === startTime) ? startTime : hourly ? null : (starts[0]?.time ?? null);
  const needsStart = !chosenStart;

  // The seat map for the chosen time, once the time is complete.
  useEffect(() => {
    if (!shared || needsStart) {
      return;
    }
    startSeats(async () => {
      const result = await getSeatMap(space.slug, { date, start_time: chosenStart, rate_unit: unit, quantity });
      setSeatMap(result.ok ? (result.data ?? null) : null);
    });
  }, [shared, needsStart, space.slug, date, chosenStart, unit, quantity]);

  const shownSeatMap = shared && !needsStart ? seatMap : null;
  const hasSeats = (shownSeatMap?.seats.length ?? 0) > 0;
  // Picks stop counting once that seat is taken for the new time, or there are more picks than people.
  const validPicks = useMemo(
    () => pickedSeats.filter((id) => shownSeatMap?.seats.some((seat) => seat.id === id && seat.available)).slice(0, seats),
    [pickedSeats, shownSeatMap, seats],
  );
  const choosing = hasSeats && seatMode === "choose";
  const seatsMissing = choosing ? seats - validPicks.length : 0;

  const input: BookingInput = useMemo(
    () => ({
      space: space.slug,
      date,
      start_time: chosenStart,
      rate_unit: unit,
      quantity,
      seats,
      seat_ids: choosing && seatsMissing === 0 ? validPicks : [],
      addons: Object.entries(addons).filter(([, count]) => count > 0).map(([id, count]) => ({ id: Number(id), quantity: count })),
      use_pass: usePass,
    }),
    [space.slug, date, unit, chosenStart, quantity, seats, choosing, seatsMissing, validPicks, addons, usePass],
  );

  // Live price whenever the booking changes and is complete enough to price.
  useEffect(() => {
    if (needsStart) {
      return;
    }
    const timer = setTimeout(() => {
      startPricing(async () => {
        const result = await getQuote(input);
        if (result.ok && result.data) {
          setQuote(result.data);
          setQuoteError(null);
          if (!result.data.eligible_pass) setUsePass(false);
        } else {
          setQuote(null);
          setQuoteError(Object.values(result.errors ?? {})[0]?.[0] ?? result.message ?? "We couldn't price this booking.");
        }
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [input, needsStart]);

  const shownQuote = needsStart ? null : quote;
  const shownQuoteError = needsStart ? null : quoteError;

  function submit() {
    setErrors({});
    setFormError(null);
    startSubmit(async () => {
      const result = await createBooking({ ...input, notes: details.notes, ...(user ? {} : { name: details.name, email: details.email, phone: details.phone }) });
      if (result.ok && result.data) {
        router.push(inDashboard ? `/dashboard/workspace/${result.data.reference}` : `/bookings/${result.data.reference}?${new URLSearchParams({ token: result.data.token })}`);
        return;
      }
      setErrors(result.errors ?? {});
      setFormError(result.message ?? (result.errors ? null : "We couldn't hold this booking. Please try again."));
      // The time was taken or no longer fits: go back to that step, where the error shows.
      if (Object.keys(result.errors ?? {}).some((field) => TIME_FIELDS.includes(field))) onBack();
    });
  }

  const quantityChoices = Array.from({ length: maxQuantity[unit] }, (_, index) => index + 1).filter((count) => {
    if (unit !== "hour") return true;
    const minutes = count * 60;
    return minutes >= space.min_duration_minutes && (!space.max_duration_minutes || minutes <= space.max_duration_minutes);
  });
  const ready = shownQuote !== null && !pricing && seatsMissing === 0;
  const seatLabels = (shownSeatMap?.seats ?? []).filter((seat) => validPicks.includes(seat.id)).map((seat) => seat.label);
  const fieldError = (key: string) => errors[key]?.[0];

  const holdLabel = shownQuote?.requires_approval
    ? "Request this booking"
    : shownQuote && shownQuote.total === 0
      ? "Confirm booking"
      : `Hold and pay ${shownQuote ? formatNaira(shownQuote.total) : ""}`;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="space-y-6">{step === "time" ? timeStep() : detailsStep()}</div>

      <div className="lg:sticky lg:top-24">
        <Card>
          <CardHeader title="Your booking" description={space.name} />
          <div className="space-y-4 p-5 sm:p-6">
            {shownQuote && (
              <dl className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2 text-foreground">
                  <Clock className="size-4 text-muted" />
                  <dt className="sr-only">When</dt>
                  <dd>{formatWhen(shownQuote)}</dd>
                </div>
                <div className="flex items-center gap-2 text-foreground">
                  <Users className="size-4 text-muted" />
                  <dt className="sr-only">People</dt>
                  <dd>
                    {seats} {seats === 1 ? "person" : "people"}
                    {hasSeats && <span className="text-muted"> · {choosing && seatLabels.length > 0 ? seatLabels.join(", ") : "any free seat"}</span>}
                  </dd>
                </div>
              </dl>
            )}
            {shownQuoteError && (
              <Alert tone="warning" icon={AlertCircle}>
                {shownQuoteError}
              </Alert>
            )}
            {!shownQuote && !shownQuoteError && <p className="text-sm text-muted">{needsStart ? "Choose a start time to see the price." : "Working out the price…"}</p>}

            {shownQuote && (
              <div className={cn("space-y-2 border-t border-border pt-4 transition-opacity", pricing && "opacity-60")}>
                {shownQuote.lines.map((line) => (
                  <div key={line.label} className="flex justify-between gap-4 text-sm">
                    <span className="text-muted">{line.label}</span>
                    <span className={cn("font-medium tabular-nums", line.amount < 0 ? "text-success" : "text-foreground")}>
                      {line.amount < 0 ? `-${formatNaira(-line.amount)}` : formatNaira(line.amount)}
                    </span>
                  </div>
                ))}
                <div className="flex items-baseline justify-between border-t border-border pt-3">
                  <span className="font-semibold text-foreground">Total</span>
                  <span className="text-2xl font-bold text-foreground">{formatNaira(shownQuote.total)}</span>
                </div>
              </div>
            )}

            {shownQuote?.eligible_pass && (
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3">
                <input type="checkbox" checked={usePass} onChange={(event) => setUsePass(event.target.checked)} className="mt-1 size-4 accent-brand-500" />
                <span className="text-sm">
                  <span className="flex items-center gap-1.5 font-semibold text-foreground">
                    <Ticket className="size-4 text-brand-500" /> Use my {shownQuote.eligible_pass.name} pass
                  </span>
                  <span className="text-muted">
                    Uses {shownQuote.eligible_pass.credits_needed} of your {shownQuote.eligible_pass.credits_left} credits left.
                  </span>
                </span>
              </label>
            )}

            {space.cancellation_policy && space.cancellation_policy.summary.length > 0 && (
              <div className="rounded-xl bg-surface-muted p-3 text-xs leading-relaxed text-muted">
                <p className="font-semibold text-foreground">Cancellation</p>
                {space.cancellation_policy.summary.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );

  function timeStep() {
    return (
      <>
        <Card>
          <CardHeader title="How long?" description={shared ? "Priced per person." : "You'll have the whole space."} />
          <div className="space-y-5 p-5 sm:p-6">
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Book by">
              {rates.map((rate) => (
                <button
                  key={rate.unit}
                  type="button"
                  role="radio"
                  aria-checked={unit === rate.unit}
                  onClick={() => {
                    setUnit(rate.unit);
                    setQuantity(rate.unit === "hour" ? Math.max(1, Math.round(space.min_duration_minutes / 60)) : 1);
                    setUsePass(false);
                  }}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm font-semibold transition",
                    unit === rate.unit ? "border-navy-900 bg-navy-900 text-white dark:border-navy-700 dark:bg-navy-700" : "border-border bg-surface text-foreground hover:border-navy-200",
                  )}
                >
                  {rateUnits.find((item) => item.unit === rate.unit)?.label} · {formatNaira(rate.price)}
                </button>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <CalendarDays className="size-4 text-muted" /> {hourly ? "Date" : "Starting"}
                </span>
                <input
                  type="date"
                  value={date}
                  min={bookingToday()}
                  onChange={(event) => event.target.value && setDate(event.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-foreground focus:border-brand-500 focus:outline-none"
                />
              </label>
              <label className="space-y-1.5">
                <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <Clock className="size-4 text-muted" /> Number of {unitLabel[unit]}s
                </span>
                <select
                  value={quantity}
                  onChange={(event) => setQuantity(Number(event.target.value))}
                  className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-foreground focus:border-brand-500 focus:outline-none"
                >
                  {quantityChoices.map((count) => (
                    <option key={count} value={count}>
                      {count} {unitLabel[unit]}
                      {count === 1 ? "" : "s"}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Users className="size-4 text-muted" /> Number of people
                </p>
                <p className="text-xs text-muted">Up to {space.capacity}</p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" aria-label="Fewer people" disabled={seats <= 1} onClick={() => setSeats((value) => Math.max(1, value - 1))}>
                  <Minus className="size-4" />
                </Button>
                <span className="w-6 text-center text-lg font-bold tabular-nums text-foreground" aria-live="polite">
                  {seats}
                </span>
                <Button variant="outline" size="icon" aria-label="More people" disabled={seats >= space.capacity} onClick={() => setSeats((value) => Math.min(space.capacity, value + 1))}>
                  <Plus className="size-4" />
                </Button>
              </div>
            </div>
            {fieldError("seats") && <p className="text-[13px] text-danger">{fieldError("seats")}</p>}
          </div>
        </Card>

        <Card>
          <CardHeader
            title={hourly ? "Start time" : "Arrival time"}
            description={
              shownDay && !shownDay.closed && shownDay.opens && shownDay.closes
                ? hourly
                  ? `Open ${formatClock(shownDay.opens)} to ${formatClock(shownDay.closes)}.`
                  : unit === "day"
                    ? `When you'll arrive on the first day. Open ${formatClock(shownDay.opens)} to ${formatClock(shownDay.closes)}; your last day ends at closing.`
                    : `When you'll arrive on the first day. It runs to the same time ${quantity} ${unitLabel[unit]}${quantity === 1 ? "" : "s"} later.`
                : undefined
            }
          />
          <div className="p-5 sm:p-6">
            {loadingDay ? (
              <DotLoader label="Checking free times" />
            ) : shownDay?.closed ? (
              <p className="text-sm text-muted">{shownDay.reason ?? "Closed that day."} Please choose another date.</p>
            ) : starts.length === 0 ? (
              <p className="text-sm text-muted">
                {hourly ? `No free ${formatMinutes(quantity * 60)} slots that day. Try a shorter booking or another date.` : "It isn't free for the rest of that day. Please choose another start date."}
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Start time">
                {starts.map((start) => (
                  <button
                    key={start.time}
                    type="button"
                    role="radio"
                    aria-checked={chosenStart === start.time}
                    onClick={() => setStartTime(start.time)}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-sm font-semibold tabular-nums transition",
                      chosenStart === start.time ? "border-brand-500 bg-brand-500 text-white" : "border-border bg-surface text-foreground hover:border-brand-500",
                    )}
                  >
                    {formatClock(start.time)}
                  </button>
                ))}
              </div>
            )}
            {fieldError("start_time") && <p className="mt-3 text-[13px] text-danger">{fieldError("start_time")}</p>}
          </div>
        </Card>

        {shared && (loadingSeats || hasSeats) && seatPicker()}

        {(space.addons ?? []).length > 0 && (
          <Card>
            <CardHeader title="Extras" description="Optional. Charged with your booking." />
            <ul className="divide-y divide-border">
              {(space.addons ?? []).map((addon) => {
                const count = addons[addon.id] ?? 0;
                return (
                  <li key={addon.id} className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{addon.name}</p>
                      <p className="text-sm text-muted">
                        {formatNaira(addon.price)} {addon.charge_type === "per_hour" ? "per hour" : addon.charge_type === "per_person" ? "per person" : "per booking"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" aria-label={`Remove ${addon.name}`} disabled={count === 0} onClick={() => setAddons((value) => ({ ...value, [addon.id]: Math.max(0, count - 1) }))}>
                        <Minus className="size-4" />
                      </Button>
                      <span className="w-5 text-center font-semibold tabular-nums">{count}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label={`Add ${addon.name}`}
                        disabled={addon.max_quantity > 0 && count >= addon.max_quantity}
                        onClick={() => setAddons((value) => ({ ...value, [addon.id]: count + 1 }))}
                      >
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        <div className="flex items-center justify-between gap-3">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="size-4" /> Back
          </Button>
          <Button size="lg" disabled={!ready} onClick={onNext}>
            Continue <ArrowRight className="size-4" />
          </Button>
        </div>
      </>
    );
  }

  function seatPicker() {
    const zones = Array.from(new Set((shownSeatMap?.seats ?? []).map((seat) => seat.zone ?? "")));
    const toggle = (id: number) =>
      setPickedSeats(() => {
        if (validPicks.includes(id)) return validPicks.filter((picked) => picked !== id);
        // One seat per person: with the limit reached, the newest pick replaces the oldest.
        return [...validPicks, id].slice(-seats);
      });

    return (
      <Card>
        <CardHeader title="Seat" description={shownSeatMap?.free != null ? `${shownSeatMap.free} of ${shownSeatMap.seats.length} free at that time.` : undefined} />
        <div className="space-y-4 p-5 sm:p-6">
          {loadingSeats && !hasSeats ? (
            <DotLoader label="Checking free seats" />
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Seat">
                {(
                  [
                    { mode: "any", title: "Any free seat", body: "We'll give you one when you book." },
                    { mode: "choose", title: seats === 1 ? "Choose my seat" : "Choose our seats", body: "Pick from the free seats below." },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.mode}
                    type="button"
                    role="radio"
                    aria-checked={seatMode === option.mode}
                    onClick={() => setSeatMode(option.mode)}
                    className={cn(
                      "rounded-xl border p-3 text-left transition",
                      seatMode === option.mode ? "border-brand-500 ring-1 ring-brand-500" : "border-border hover:border-navy-200",
                    )}
                  >
                    <span className="block text-sm font-semibold text-foreground">{option.title}</span>
                    <span className="block text-xs text-muted">{option.body}</span>
                  </button>
                ))}
              </div>

              {choosing && (
                <div className={cn("space-y-4 transition-opacity", loadingSeats && "opacity-60")}>
                  {zones.map((zone) => (
                    <div key={zone || "seats"}>
                      {zones.length > 1 && <p className="mb-2 text-xs font-semibold text-muted">{zone || "Other seats"}</p>}
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                        {(shownSeatMap?.seats ?? [])
                          .filter((seat) => (seat.zone ?? "") === zone)
                          .map((seat) => {
                            const picked = validPicks.includes(seat.id);
                            return (
                              <button
                                key={seat.id}
                                type="button"
                                aria-pressed={picked}
                                disabled={!seat.available}
                                onClick={() => toggle(seat.id)}
                                className={cn(
                                  "rounded-xl border px-2 py-2.5 text-sm font-semibold transition",
                                  !seat.available && "cursor-not-allowed border-dashed border-border bg-surface-muted text-muted line-through",
                                  seat.available && !picked && "border-border bg-surface text-foreground hover:border-brand-500",
                                  picked && "border-brand-500 bg-brand-500 text-white",
                                )}
                              >
                                {seat.label}
                                <span className="sr-only">{seat.available ? (picked ? ", chosen" : ", free") : ", taken"}</span>
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  ))}
                  <p className={cn("text-[13px]", seatsMissing > 0 ? "text-muted" : "text-success")}>
                    {seatsMissing > 0
                      ? `Choose ${seatsMissing} more ${seatsMissing === 1 ? "seat" : "seats"}${seats > 1 ? `, one for each person` : ""}.`
                      : `${seatLabels.join(", ")} ${seatLabels.length === 1 ? "is" : "are"} yours if you book now.`}
                  </p>
                </div>
              )}
              {fieldError("seat_ids") && <p className="text-[13px] text-danger">{fieldError("seat_ids")}</p>}
            </>
          )}
        </div>
      </Card>
    );
  }

  function detailsStep() {
    return (
      <>
        <Card>
          <CardHeader title={user ? "Booking as" : "Your details"} description={user ? `${user.name} · ${user.email}` : "We'll send your confirmation here. No account needed."} />
          <div className="space-y-4 p-5 sm:p-6">
            {formError && (
              <Alert tone="danger" icon={AlertCircle}>
                {formError}
              </Alert>
            )}
            {!user && (
              <>
                <TextField label="Full name" name="name" autoComplete="name" value={details.name} onChange={(event) => setDetails({ ...details, name: event.target.value })} error={errors.name} required />
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="Email" name="email" type="email" autoComplete="email" value={details.email} onChange={(event) => setDetails({ ...details, email: event.target.value })} error={errors.email} required />
                  <TextField label="Phone" name="phone" type="tel" autoComplete="tel" value={details.phone} onChange={(event) => setDetails({ ...details, phone: event.target.value })} error={errors.phone} required />
                </div>
              </>
            )}
            <TextareaField label="Anything we should know?" name="notes" rows={2} value={details.notes} onChange={(event) => setDetails({ ...details, notes: event.target.value })} error={errors.notes} hint="Optional" />
          </div>
        </Card>

        <div className="space-y-3">
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="outline" onClick={onBack} disabled={submitting}>
              <ArrowLeft className="size-4" /> Back
            </Button>
            <Button size="lg" disabled={!ready || submitting} onClick={submit}>
              {submitting ? <DotLoader className="text-current" label="Holding your space" /> : holdLabel}
            </Button>
          </div>
          <p className="flex items-start gap-1.5 text-xs text-muted sm:justify-end">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
            {shownQuote?.requires_approval
              ? "Our team reviews requests for this space. You'll pay once it's approved."
              : `We hold the space for ${shownQuote?.hold_minutes ?? 15} minutes while you pay. It's confirmed as soon as payment goes through.`}
          </p>
          <p className="text-xs text-muted sm:text-right">
            By booking you agree to our{" "}
            <Link href="/terms" className="font-semibold text-foreground hover:underline">
              terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="font-semibold text-foreground hover:underline">
              privacy policy
            </Link>
            .
          </p>
        </div>
      </>
    );
  }
}
