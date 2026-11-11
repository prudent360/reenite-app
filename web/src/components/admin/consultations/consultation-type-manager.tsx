"use client";

import { useState, useTransition } from "react";
import { CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteConsultationType, saveConsultationType } from "@/lib/actions/consultations";
import type { ConsultationMode, ConsultationType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui/card";
import { SelectField, SwitchField, TextField, TextareaField } from "@/components/ui/form";
import { DotLoader } from "@/components/ui/loader";
import { formatNaira } from "@/lib/utils";

const days = [
  { key: "1", label: "Mon" },
  { key: "2", label: "Tue" },
  { key: "3", label: "Wed" },
  { key: "4", label: "Thu" },
  { key: "5", label: "Fri" },
  { key: "6", label: "Sat" },
  { key: "7", label: "Sun" },
];

const modes: { value: ConsultationMode; label: string }[] = [
  { value: "video", label: "Video call" },
  { value: "phone", label: "Phone call" },
  { value: "in_person", label: "In person at our office" },
];

function hoursSummary(schedule: ConsultationType["schedule"]): string {
  const open = days.filter((day) => schedule[day.key]);
  if (open.length === 0) return "No days open";
  const first = schedule[open[0]!.key]!;
  const same = open.every((day) => schedule[day.key]![0] === first[0] && schedule[day.key]![1] === first[1]);
  return same ? `${open.map((day) => day.label).join(", ")} · ${first[0]} to ${first[1]}` : open.map((day) => `${day.label} ${schedule[day.key]![0]}–${schedule[day.key]![1]}`).join(", ");
}

/** The consultations customers can book. */
export function ConsultationTypeManager({ types }: { types: ConsultationType[] }) {
  const [editing, setEditing] = useState<ConsultationType | "new" | null>(null);

  return (
    <Card>
      <CardHeader
        title="Consultations on offer"
        description="What customers can book, how long it lasts, the price and the weekly hours. One session of each runs at a time."
        action={
          !editing && (
            <Button size="sm" onClick={() => setEditing("new")}>
              <Plus className="size-4" /> Add consultation
            </Button>
          )
        }
      />
      {editing && (
        <div className="border-b border-border">
          <TypeForm type={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
        </div>
      )}
      {types.length === 0 && !editing ? (
        <EmptyState icon={CalendarClock} title="No consultations yet" description="Add one so customers can book time with your officers." />
      ) : (
        <ul className="divide-y divide-border">
          {types.map((type) => (
            <TypeRow key={type.id} type={type} onEdit={() => setEditing(type)} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function TypeRow({ type, onEdit }: { type: ConsultationType; onEdit: () => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
          {type.name} {!type.is_active && <Badge>Off</Badge>}
        </p>
        <p className="mt-0.5 text-sm text-muted">
          {type.duration_minutes} min · {type.mode_label} · {type.price > 0 ? formatNaira(type.price) : "Free"} · {type.upcoming_count ?? 0} upcoming
        </p>
        <p className="text-sm text-muted">{hoursSummary(type.schedule)}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="outline" onClick={onEdit}>
          <Pencil className="size-4" /> Edit
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-9 text-danger"
          aria-label={`Delete ${type.name}`}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteConsultationType(type.slug);
              if (result.ok) toast.success(result.message);
              else toast.error(result.message ?? "We couldn't delete it.");
            })
          }
        >
          {pending ? <DotLoader className="text-current" label="Deleting" /> : <Trash2 className="size-4" />}
        </Button>
      </div>
    </li>
  );
}

function TypeForm({ type, onDone }: { type: ConsultationType | null; onDone: () => void }) {
  const [form, setForm] = useState({
    name: type?.name ?? "",
    description: type?.description ?? "",
    duration_minutes: String(type?.duration_minutes ?? 60),
    price: type ? String(type.price / 100) : "",
    mode: type?.mode ?? ("video" as ConsultationMode),
    notice_hours: String(type?.notice_hours ?? 12),
    is_active: type?.is_active ?? true,
    sort_order: String(type?.sort_order ?? 0),
  });
  const [schedule, setSchedule] = useState<Record<string, [string, string]>>(
    type?.schedule ?? { "1": ["09:00", "16:00"], "2": ["09:00", "16:00"], "3": ["09:00", "16:00"], "4": ["09:00", "16:00"], "5": ["09:00", "16:00"] },
  );
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, startSaving] = useTransition();

  function toggleDay(key: string, on: boolean) {
    setSchedule((current) => {
      const next = { ...current };
      if (on) next[key] = current[key] ?? ["09:00", "16:00"];
      else delete next[key];
      return next;
    });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startSaving(async () => {
      const result = await saveConsultationType(type?.slug ?? null, {
        name: form.name.trim(),
        description: form.description.trim() || null,
        duration_minutes: Number(form.duration_minutes),
        price: Math.round(Number(form.price || 0) * 100),
        mode: form.mode,
        schedule,
        notice_hours: Number(form.notice_hours || 0),
        is_active: form.is_active,
        sort_order: Number(form.sort_order || 0),
      });
      setErrors(result.errors ?? {});
      if (result.ok) {
        toast.success(result.message);
        onDone();
      } else {
        toast.error(result.message ?? "Please fix the highlighted fields.");
      }
    });
  }

  const scheduleError = errors.schedule?.[0] ?? Object.entries(errors).find(([key]) => key.startsWith("schedule."))?.[1]?.[0];

  return (
    <form noValidate onSubmit={submit} className="space-y-5 p-5 sm:p-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Name" name="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} error={errors.name} placeholder="e.g. Tax and compliance review" className="sm:col-span-2" />
        <TextareaField label="Description" name="description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} error={errors.description} hint="Shown to customers when they choose." className="sm:col-span-2" />
        <SelectField label="Length" name="duration_minutes" value={form.duration_minutes} onChange={(event) => setForm({ ...form, duration_minutes: event.target.value })} error={errors.duration_minutes}>
          {[15, 30, 45, 60, 90, 120].map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes} minutes
            </option>
          ))}
        </SelectField>
        <TextField label="Price" name="price" type="number" min="0" step="100" leading="₦" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} error={errors.price} hint="0 makes it free." />
        <SelectField label="How it happens" name="mode" value={form.mode} onChange={(event) => setForm({ ...form, mode: event.target.value as ConsultationMode })} error={errors.mode}>
          {modes.map((mode) => (
            <option key={mode.value} value={mode.value}>
              {mode.label}
            </option>
          ))}
        </SelectField>
        <TextField label="Notice needed (hours)" name="notice_hours" type="number" min="0" max="336" value={form.notice_hours} onChange={(event) => setForm({ ...form, notice_hours: event.target.value })} error={errors.notice_hours} hint="How soon before a session it can be booked." />
      </div>

      <fieldset className="space-y-3 rounded-xl border border-border p-4">
        <legend className="px-1 text-sm font-semibold text-foreground">Weekly hours (Lagos time)</legend>
        {days.map((day) => {
          const hours = schedule[day.key];
          return (
            <div key={day.key} className="flex flex-wrap items-center gap-3">
              <label className="flex w-20 items-center gap-2 text-sm font-medium text-foreground">
                <input type="checkbox" checked={Boolean(hours)} onChange={(event) => toggleDay(day.key, event.target.checked)} className="size-4 accent-brand-500" />
                {day.label}
              </label>
              {hours ? (
                <>
                  <input type="time" aria-label={`${day.label} opens`} value={hours[0]} onChange={(event) => setSchedule({ ...schedule, [day.key]: [event.target.value, hours[1]] })} className="h-9 rounded-lg border border-border bg-surface px-2 text-sm text-foreground" />
                  <span className="text-sm text-muted">to</span>
                  <input type="time" aria-label={`${day.label} closes`} value={hours[1]} onChange={(event) => setSchedule({ ...schedule, [day.key]: [hours[0], event.target.value] })} className="h-9 rounded-lg border border-border bg-surface px-2 text-sm text-foreground" />
                </>
              ) : (
                <span className="text-sm text-muted">Closed</span>
              )}
            </div>
          );
        })}
        {scheduleError && <p className="text-[13px] text-danger">{scheduleError}</p>}
      </fieldset>

      <SwitchField label="Customers can book it" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? <DotLoader className="text-current" label="Saving" /> : type ? "Save" : "Add consultation"}
        </Button>
      </div>
    </form>
  );
}
