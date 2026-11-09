"use client";

import { useState, useTransition } from "react";
import { Copy, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { saveWorkspaceItem, type WorkspaceKind } from "@/lib/actions/workspace";
import type { OpeningDay } from "@/lib/types";
import { cn } from "@/lib/utils";
import { dayNames } from "@/lib/workspace";
import { Button } from "@/components/ui/button";

/** Naira typed by an admin ("4,500") to kobo; blank or junk becomes NaN for the API to reject. */
export const toKobo = (naira: string) => Math.round(Number(naira.replace(/[₦,\s]/g, "")) * 100);
export const toNaira = (kobo: number) => String(kobo / 100);

/**
 * Saves a JSON body to the workspace API and keeps the field errors it returns.
 */
export function useWorkspaceSave(kind: WorkspaceKind, id: number | null) {
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, startSaving] = useTransition();

  function save(body: object, onSaved?: (id: number) => void) {
    startSaving(async () => {
      const result = await saveWorkspaceItem(kind, id, body);
      setErrors(result.errors ?? {});
      if (result.ok) {
        toast.success(result.message);
        onSaved?.(result.id!);
      } else {
        toast.error(result.message ?? "Please fix the highlighted fields.");
      }
    });
  }

  /** First error for a field, as the array the form fields expect. */
  const error = (field: string) => (errors[field] ? [errors[field][0]] : undefined);

  return { save, saving, errors, error };
}

const timeClasses =
  "h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15 aria-invalid:border-danger disabled:opacity-40";

/** Seven rows of open/closed toggles with opening and closing times. */
export function HoursEditor({ value, onChange, errors, prefix = "hours" }: { value: OpeningDay[]; onChange: (hours: OpeningDay[]) => void; errors: Record<string, string[]>; prefix?: string }) {
  const update = (day: number, patch: Partial<OpeningDay>) => onChange(value.map((entry) => (entry.day === day ? { ...entry, ...patch } : entry)));
  const monday = value.find((entry) => entry.day === 1)!;

  return (
    <div className="space-y-2">
      {value.map((entry, index) => {
        const error = errors[`${prefix}.${index}.closes`]?.[0] ?? errors[`${prefix}.${index}.opens`]?.[0];
        return (
          <div key={entry.day}>
            <div className="grid grid-cols-[110px_auto_1fr_1fr] items-center gap-3 sm:grid-cols-[130px_auto_150px_150px]">
              <span className="text-sm font-medium text-foreground">{dayNames[entry.day]}</span>
              <label className="flex items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={!entry.closed}
                  onChange={(event) => update(entry.day, event.target.checked ? { closed: false, opens: entry.opens ?? "09:00", closes: entry.closes ?? "17:00" } : { closed: true })}
                  className="size-4 accent-[#f05a28]"
                  aria-label={`Open on ${dayNames[entry.day]}`}
                />
                <span className="w-12">{entry.closed ? "Closed" : "Open"}</span>
              </label>
              <input type="time" step={900} value={entry.opens ?? ""} disabled={entry.closed} onChange={(event) => update(entry.day, { opens: event.target.value })} aria-label={`${dayNames[entry.day]} opens`} aria-invalid={Boolean(error)} className={timeClasses} />
              <input type="time" step={900} value={entry.closes ?? ""} disabled={entry.closed} onChange={(event) => update(entry.day, { closes: event.target.value })} aria-label={`${dayNames[entry.day]} closes`} aria-invalid={Boolean(error)} className={timeClasses} />
            </div>
            {error && <p className="mt-1 text-[13px] text-danger sm:ml-[146px]">{error}</p>}
          </div>
        );
      })}
      <Button
        variant="ghost"
        size="sm"
        className="mt-1"
        onClick={() => onChange(value.map((entry) => (entry.day >= 2 && entry.day <= 5 ? { ...entry, opens: monday.opens, closes: monday.closes, closed: monday.closed } : entry)))}
      >
        <Copy className="size-4" /> Copy Monday to Tue to Fri
      </Button>
    </div>
  );
}

/** A short list of free-text items, e.g. amenities or membership perks. */
export function ListInput({ label, value, onChange, placeholder, hint }: { label: string; value: string[]; onChange: (items: string[]) => void; placeholder?: string; hint?: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const item = draft.trim();
    if (item && !value.includes(item)) onChange([...value, item]);
    setDraft("");
  };

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-foreground">{label}</p>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((item) => (
            <li key={item} className="inline-flex items-center gap-1 rounded-lg bg-surface-muted py-1 pl-2.5 pr-1 text-sm text-foreground">
              {item}
              <button type="button" onClick={() => onChange(value.filter((other) => other !== item))} className="rounded p-0.5 text-muted hover:bg-danger-soft hover:text-danger" aria-label={`Remove ${item}`}>
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          aria-label={label}
          className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3.5 text-sm text-foreground placeholder:text-navy-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
        />
        <Button variant="outline" size="sm" className="h-10" onClick={add} disabled={!draft.trim()}>
          <Plus className="size-4" /> Add
        </Button>
      </div>
      {hint && <p className="text-[13px] text-muted">{hint}</p>}
    </div>
  );
}

/** Pill toggle group for choosing several ids. */
export function MultiToggle<T extends string | number>({ options, value, onChange, label }: { options: { value: T; label: string; hint?: string }[]; value: T[]; onChange: (value: T[]) => void; label: string }) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-foreground">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => {
          const on = value.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((v) => v !== option.value) : [...value, option.value])}
              className={cn("rounded-xl border px-3 py-2 text-left text-sm transition", on ? "border-brand-500 bg-brand-50 font-semibold text-brand-700" : "border-border text-foreground hover:border-brand-500/50")}
            >
              {option.label}
              {option.hint && <span className="block text-xs font-normal text-muted">{option.hint}</span>}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
