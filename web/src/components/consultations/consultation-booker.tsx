"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, MapPin, Phone, Video } from "lucide-react";
import { toast } from "sonner";
import { bookConsultation, consultationSlots } from "@/lib/actions/consultations";
import type { ConsultationType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { TextareaField } from "@/components/ui/form";
import { DotLoader } from "@/components/ui/loader";
import { cn, formatNaira } from "@/lib/utils";

const modeIcons = { in_person: MapPin, video: Video, phone: Phone };
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" });
const dayLabel = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short" });
const weekdayIso = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", weekday: "short" });
const isoDay: Record<string, string> = { Mon: "1", Tue: "2", Wed: "3", Thu: "4", Fri: "5", Sat: "6", Sun: "7" };

/** The next three weeks of days the consultation runs on. */
function openDays(type: ConsultationType): { key: string; label: string }[] {
  const days: { key: string; label: string }[] = [];
  for (let offset = 0; offset < 21; offset++) {
    const date = new Date(Date.now() + offset * 86_400_000);
    if (type.schedule[isoDay[weekdayIso.format(date)] ?? ""]) days.push({ key: dayKey.format(date), label: dayLabel.format(date) });
  }
  return days;
}

/** Pick a consultation, a day and a time, say what it's about, and book. */
export function ConsultationBooker({ types, initialSlug }: { types: ConsultationType[]; initialSlug?: string }) {
  const router = useRouter();
  const [type, setType] = useState<ConsultationType | null>(() => types.find((option) => option.slug === initialSlug) ?? (types.length === 1 ? types[0]! : null));
  const days = useMemo(() => (type ? openDays(type) : []), [type]);
  const [day, setDay] = useState<string | null>(null);
  const [slots, setSlots] = useState<{ starts_at: string; label: string }[] | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [loading, startLoading] = useTransition();
  const [booking, startBooking] = useTransition();

  function load(forType: ConsultationType, forDay: string | null) {
    setDay(forDay);
    setSlot(null);
    setSlots(null);
    if (forDay) startLoading(async () => setSlots(await consultationSlots(forType.slug, forDay)));
  }

  function chooseType(option: ConsultationType) {
    setType(option);
    load(option, openDays(option)[0]?.key ?? null);
  }

  // A consultation chosen before arriving (?type=...) starts on its first open day.
  useEffect(() => {
    if (type && day === null) startLoading(() => load(type, days[0]?.key ?? null));
    // Only on first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function book() {
    if (!type || !slot) return;
    startBooking(async () => {
      const result = await bookConsultation({ consultation_type_id: type.id, starts_at: slot, topic: topic.trim() });
      setErrors(result.errors ?? {});
      if (result.ok) {
        toast.success(result.message);
        router.push(`/dashboard/consultations/${result.reference}`);
      } else {
        toast.error(result.errors?.starts_at?.[0] ?? result.message ?? "Please check the form.");
        if (result.errors?.starts_at && day) setSlots(await consultationSlots(type.slug, day));
      }
    });
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <Card>
          <CardHeader title="1. Choose a consultation" />
          <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6" role="radiogroup" aria-label="Consultation">
            {types.map((option) => {
              const Icon = modeIcons[option.mode];
              const selected = type?.id === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => chooseType(option)}
                  className={cn(
                    "flex flex-col gap-2 rounded-2xl border p-4 text-left transition",
                    selected ? "border-brand-500 bg-brand-50/60 ring-2 ring-brand-500/20 dark:bg-brand-500/10" : "border-border hover:border-brand-500/50",
                  )}
                >
                  <span className="font-semibold text-foreground">{option.name}</span>
                  {option.description && <span className="text-sm text-muted">{option.description}</span>}
                  <span className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-sm text-muted">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3.5" /> {option.duration_minutes} min
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Icon className="size-3.5" /> {option.mode_label}
                    </span>
                    <span className="font-semibold text-foreground">{option.price > 0 ? formatNaira(option.price) : "Free"}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        {type && (
          <Card>
            <CardHeader title="2. Pick a time" description="Times are in Lagos time (WAT)." />
            <div className="space-y-5 p-5 sm:p-6">
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="radiogroup" aria-label="Day">
                {days.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    role="radio"
                    aria-checked={day === option.key}
                    onClick={() => type && load(type, option.key)}
                    className={cn(
                      "shrink-0 rounded-xl border px-3.5 py-2 text-sm font-semibold transition",
                      day === option.key ? "border-navy-900 bg-navy-900 text-white dark:border-white dark:bg-white dark:text-navy-900" : "border-border text-foreground hover:border-brand-500/50",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {loading || (slots === null && day !== null) ? (
                <div className="flex h-24 items-center justify-center">
                  <DotLoader className="text-navy-300" label="Finding free times" />
                </div>
              ) : !slots || slots.length === 0 ? (
                <p className="rounded-xl bg-surface-muted px-4 py-6 text-center text-sm text-muted">No free times on this day. Try another day.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Start time">
                  {slots.map((option) => (
                    <button
                      key={option.starts_at}
                      type="button"
                      role="radio"
                      aria-checked={slot === option.starts_at}
                      onClick={() => setSlot(option.starts_at)}
                      className={cn(
                        "rounded-xl border py-2.5 text-sm font-semibold transition",
                        slot === option.starts_at ? "border-brand-500 bg-brand-500 text-white" : "border-border text-foreground hover:border-brand-500/50",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
              {errors.starts_at && <p className="text-[13px] text-danger">{errors.starts_at[0]}</p>}
            </div>
          </Card>
        )}
      </div>

      <Card className="lg:sticky lg:top-24">
        <CardHeader title="3. What would you like to discuss?" />
        <div className="space-y-4 p-5 sm:p-6">
          <TextareaField
            label="Topic"
            name="topic"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            error={errors.topic}
            placeholder="e.g. I sell food online and want to know if I need to register for VAT."
            hint="So the right officer can prepare."
          />
          {type && (
            <dl className="space-y-1.5 rounded-xl bg-surface-muted p-4 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Consultation</dt>
                <dd className="text-right font-medium text-foreground">{type.name}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">When</dt>
                <dd className="text-right font-medium text-foreground">
                  {slot ? `${days.find((option) => option.key === day)?.label}, ${slots?.find((option) => option.starts_at === slot)?.label}` : "Pick a time"}
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-border pt-1.5">
                <dt className="text-muted">Price</dt>
                <dd className="font-bold text-foreground">{type.price > 0 ? formatNaira(type.price) : "Free"}</dd>
              </div>
            </dl>
          )}
          <Button className="w-full" disabled={!type || !slot || booking} onClick={book}>
            {booking ? <DotLoader className="text-current" label="Booking" /> : type && type.price > 0 ? `Hold time and pay ${formatNaira(type.price)}` : "Book consultation"}
          </Button>
          <p className="text-[13px] text-muted">
            {type && type.price > 0 ? "We hold the time for 30 minutes while you pay. " : ""}Cancel at least 24 hours before for a full refund.
          </p>
        </div>
      </Card>
    </div>
  );
}
