"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertCircle, Plus, Search, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { createInvoice, searchCustomers } from "@/lib/actions/finance";
import type { Service } from "@/lib/types";
import { formatNaira } from "@/lib/utils";
import { Alert, Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DotLoader } from "@/components/ui/loader";
import { SwitchField, TextField, TextareaField } from "@/components/ui/form";

type Line = { key: number; description: string; quantity: number; unit_amount: string; service_id: number | null };
type Customer = { id: number; name: string; email: string };

let lineKey = 0;
const blankLine = (): Line => ({ key: ++lineKey, description: "", quantity: 1, unit_amount: "", service_id: null });
const toKobo = (value: string) => Math.round(Number(value.replace(/[₦,\s]/g, "")) * 100) || 0;

export function InvoiceForm({ services }: { services: Service[] }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Customer[]>([]);
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [dueAt, setDueAt] = useState(() => new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [notify, setNotify] = useState(true);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, startSaving] = useTransition();

  // Debounced customer search.
  useEffect(() => {
    if (customer || query.trim().length < 2) return;
    const timer = setTimeout(async () => setMatches(await searchCustomers(query)), 300);
    return () => clearTimeout(timer);
  }, [query, customer]);

  const total = lines.reduce((sum, line) => sum + line.quantity * toKobo(line.unit_amount), 0);
  const updateLine = (key: number, patch: Partial<Line>) => setLines(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  function addService(serviceId: string) {
    const service = services.find((item) => item.id === Number(serviceId));
    if (!service) return;
    const line = { ...blankLine(), description: service.name, unit_amount: String(service.total_fee / 100), service_id: service.id };
    setLines(lines.length === 1 && !lines[0]!.description && !lines[0]!.unit_amount ? [line] : [...lines, line]);
  }

  function submit() {
    startSaving(async () => {
      const result = await createInvoice({
        customer_id: customer?.id ?? null,
        items: lines.map(({ description, quantity, unit_amount, service_id }) => ({ description, quantity, unit_amount, service_id })),
        due_at: dueAt,
        notes,
        notify,
      });
      // On success the action redirects to the new invoice.
      if (result && !result.ok) {
        setErrors(result.errors ?? {});
        toast.error(result.message ?? "Please check the highlighted fields.");
      }
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
      <div className="space-y-6">
        <Card>
          <CardHeader title="Customer" />
          <div className="p-5">
            {customer ? (
              <div className="flex items-center gap-3 rounded-xl border border-border p-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-navy-900 text-white dark:bg-navy-700">
                  <UserRound className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">{customer.name}</p>
                  <p className="text-sm text-muted">{customer.email}</p>
                </div>
                <Button variant="ghost" size="icon" className="size-9" onClick={() => setCustomer(null)} aria-label="Change customer">
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <div className="relative">
                <TextField
                  label="Find a customer"
                  name="customer_search"
                  leading={<Search className="size-4" />}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Name, email or phone"
                  error={errors.customer_id}
                  autoComplete="off"
                />
                {matches.length > 0 && query.trim().length >= 2 && (
                  <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border bg-surface shadow-pop">
                    {matches.map((match) => (
                      <li key={match.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomer(match);
                            setMatches([]);
                          }}
                          className="flex w-full flex-col px-4 py-2.5 text-left hover:bg-surface-muted"
                        >
                          <span className="text-sm font-semibold text-foreground">{match.name}</span>
                          <span className="text-xs text-muted">{match.email}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Items"
            action={
              <select
                aria-label="Add a service from the catalogue"
                value=""
                onChange={(event) => addService(event.target.value)}
                className="h-9 rounded-lg border border-border bg-surface px-2.5 text-sm text-foreground"
              >
                <option value="">+ Add from catalogue…</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} ({formatNaira(service.total_fee)})
                  </option>
                ))}
              </select>
            }
          />
          <div className="space-y-3 p-5">
            {errors.items && (
              <Alert tone="danger" icon={AlertCircle}>
                {errors.items[0]}
              </Alert>
            )}
            {lines.map((line, index) => (
              <div key={line.key} className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-[minmax(0,1fr)_90px_150px_auto] sm:items-end">
                <TextField
                  label="Description"
                  name={`description-${line.key}`}
                  value={line.description}
                  onChange={(event) => updateLine(line.key, { description: event.target.value })}
                  error={errors[`items.${index}.description`]}
                />
                <TextField
                  label="Qty"
                  name={`quantity-${line.key}`}
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(event) => updateLine(line.key, { quantity: Math.max(1, Number(event.target.value) || 1) })}
                  error={errors[`items.${index}.quantity`]}
                />
                <TextField
                  label="Price"
                  name={`price-${line.key}`}
                  leading="₦"
                  inputMode="decimal"
                  value={line.unit_amount}
                  onChange={(event) => updateLine(line.key, { unit_amount: event.target.value })}
                  error={errors[`items.${index}.unit_amount`]}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 hover:bg-danger-soft hover:text-danger"
                  onClick={() => setLines(lines.filter((item) => item.key !== line.key))}
                  disabled={lines.length === 1}
                  aria-label="Remove line"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" className="w-full border-dashed" onClick={() => setLines([...lines, blankLine()])}>
              <Plus className="size-4" /> Add line
            </Button>
          </div>
        </Card>
      </div>

      <Card className="xl:sticky xl:top-24">
        <CardHeader title="Summary" />
        <div className="space-y-5 p-5">
          <div className="flex items-center justify-between rounded-xl bg-surface-muted px-4 py-3">
            <span className="text-sm text-muted">Total</span>
            <span className="font-display text-2xl font-extrabold text-foreground">{formatNaira(total)}</span>
          </div>
          <TextField label="Due date" name="due_at" type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} error={errors.due_at} />
          <TextareaField label="Note to customer (optional)" name="notes" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} error={errors.notes} />
          <SwitchField name="notify" label="Email the customer" description="Sends the 'New invoice' email with a pay link." checked={notify} onChange={(event) => setNotify(event.target.checked)} />
          <Button size="lg" className="w-full" onClick={submit} disabled={saving || !customer || total === 0}>
            {saving ? <DotLoader className="text-current" /> : "Create invoice"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
