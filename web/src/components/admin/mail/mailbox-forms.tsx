"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { toast } from "sonner";
import { openMailbox, searchMailCustomers, updateMailbox } from "@/lib/actions/mailbox";
import type { CustomerOption, Location, Mailbox } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { SelectField, TextField, TextareaField } from "@/components/ui/form";
import { DotLoader } from "@/components/ui/loader";

const dateInLagos = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" });

/** Open a mailbox by hand, e.g. for a customer who paid at the desk. Memberships open their own. */
export function OpenMailboxForm({ locations, onCancel }: { locations: Location[]; onCancel?: () => void }) {
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerOption | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerOption[]>([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [form, setForm] = useState({ location_id: locations[0] ? String(locations[0].id) : "", business_name: "", active_until: "", notes: "" });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, startSaving] = useTransition();

  function search(value: string) {
    setQuery(value);
    clearTimeout(timer.current);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(async () => {
      setResults(await searchMailCustomers(value.trim()));
      setSearching(false);
    }, 250);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startSaving(async () => {
      const result = await openMailbox({
        user_id: customer?.id ?? null,
        location_id: form.location_id ? Number(form.location_id) : null,
        business_name: form.business_name,
        active_until: form.active_until || null,
        notes: form.notes || null,
      });
      setErrors(result.errors ?? {});
      if (result.ok) {
        toast.success(result.message);
        router.push(`/admin/mail/${result.id}`);
      } else {
        toast.error(result.message ?? "Please fix the highlighted fields.");
      }
    });
  }

  return (
    <form noValidate className="space-y-4" onSubmit={submit}>
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-foreground">Customer</p>
        {customer ? (
          <div className="flex items-center gap-3 rounded-xl border border-border px-3.5 py-2.5 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-foreground">{customer.name}</span>
              <span className="block truncate text-muted">{customer.email}</span>
            </span>
            <Button variant="ghost" size="icon" className="size-8" onClick={() => setCustomer(null)} aria-label="Choose another customer">
              <X className="size-4" />
            </Button>
          </div>
        ) : (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(event) => search(event.target.value)}
              placeholder="Search by name or email"
              aria-label="Search customers"
              aria-invalid={errors.user_id ? true : undefined}
              className="h-11 w-full rounded-xl border border-border bg-surface pl-10 pr-10 text-[15px] text-foreground focus:border-brand-500 focus:outline-none aria-invalid:border-danger"
            />
            {searching && <DotLoader className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-300" label="Searching" />}
            {results.length > 0 && (
              <ul className="absolute inset-x-0 top-full z-10 mt-1 max-h-60 overflow-auto rounded-xl border border-border bg-surface shadow-pop">
                {results.map((option) => (
                  <li key={option.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomer(option);
                        setResults([]);
                        setQuery("");
                        setForm((current) => ({ ...current, business_name: current.business_name || option.name }));
                      }}
                      className="block w-full px-3.5 py-2.5 text-left text-sm hover:bg-surface-muted"
                    >
                      <span className="block font-semibold text-foreground">{option.name}</span>
                      <span className="block text-muted">{option.email}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {query.trim().length >= 2 && !searching && results.length === 0 && <p className="mt-1 text-xs text-muted">No customer accounts match. They need to register first.</p>}
          </div>
        )}
        {errors.user_id && <p className="text-[13px] text-danger">{errors.user_id[0]}</p>}
      </div>
      <SelectField label="Location" name="location_id" value={form.location_id} onChange={(event) => setForm({ ...form, location_id: event.target.value })} error={errors.location_id}>
        {locations.map((location) => (
          <option key={location.id} value={location.id}>
            {location.name}
          </option>
        ))}
      </SelectField>
      <TextField label="Name on the mailbox" name="business_name" value={form.business_name} onChange={(event) => setForm({ ...form, business_name: event.target.value })} error={errors.business_name} hint="The business name mail will be addressed to." />
      <TextField label="Paid until (optional)" name="active_until" type="date" value={form.active_until} onChange={(event) => setForm({ ...form, active_until: event.target.value })} error={errors.active_until} hint="Leave empty for no end date." />
      <TextareaField label="Note for the team (optional)" name="notes" rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} error={errors.notes} />
      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={saving}>
          {saving ? <DotLoader className="text-current" /> : "Open mailbox"}
        </Button>
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

export function EditMailboxForm({ mailbox }: { mailbox: Mailbox }) {
  const [form, setForm] = useState({
    business_name: mailbox.business_name,
    status: mailbox.status,
    active_until: mailbox.active_until ? dateInLagos.format(new Date(mailbox.active_until)) : "",
    notes: mailbox.notes ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, startSaving] = useTransition();

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        startSaving(async () => {
          const result = await updateMailbox(mailbox.id, { ...form, active_until: form.active_until || null, notes: form.notes || null });
          setErrors(result.errors ?? {});
          if (result.ok) toast.success(result.message);
          else toast.error(result.message ?? "Please fix the highlighted fields.");
        });
      }}
    >
      <TextField label="Name on the mailbox" name="business_name" value={form.business_name} onChange={(event) => setForm({ ...form, business_name: event.target.value })} error={errors.business_name} />
      <SelectField label="Status" name="status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Mailbox["status"] })} error={errors.status}>
        <option value="active">Open</option>
        <option value="closed">Closed (no new mail)</option>
      </SelectField>
      <TextField
        label="Paid until"
        name="active_until"
        type="date"
        value={form.active_until}
        onChange={(event) => setForm({ ...form, active_until: event.target.value })}
        error={errors.active_until}
        hint={mailbox.membership ? "Renewing the membership moves this date on automatically." : "Leave empty for no end date."}
      />
      <TextareaField label="Note for the team" name="notes" rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} error={errors.notes} />
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? <DotLoader className="text-current" /> : "Save"}
      </Button>
    </form>
  );
}
