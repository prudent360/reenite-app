"use client";

import { useState, useTransition } from "react";
import { AlertCircle, ArrowDown, ArrowUp, Gift, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { deleteBundle, saveBundle } from "@/lib/actions/catalogue";
import type { Bundle, FormState, Service } from "@/lib/types";
import { cn, formatNaira } from "@/lib/utils";
import { Alert, Badge, Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DotLoader } from "@/components/ui/loader";
import { SwitchField, TextField, TextareaField } from "@/components/ui/form";

export function BundleManager({ bundles, services }: { bundles: Bundle[]; services: Service[] }) {
  const [editingId, setEditingId] = useState<number | "new" | null>(bundles.length === 0 ? "new" : null);
  const [deleting, startDeleting] = useTransition();
  const editing = typeof editingId === "number" ? bundles.find((bundle) => bundle.id === editingId) : undefined;

  function remove(bundle: Bundle) {
    if (!window.confirm(`Delete the "${bundle.name}" bundle?`)) {
      return;
    }
    startDeleting(async () => {
      const result = await deleteBundle(bundle.id);
      if (result.ok) {
        toast.success(result.message);
        if (editingId === bundle.id) setEditingId(null);
      } else {
        toast.error(result.message ?? "Couldn't delete this bundle.");
      }
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px] xl:items-start">
      <Card className="overflow-hidden">
        <CardHeader
          title="Bundles"
          description="Packages of services sold together at a better price."
          action={
            <Button size="sm" onClick={() => setEditingId("new")}>
              <Plus className="size-4" /> New bundle
            </Button>
          }
        />
        {bundles.length === 0 ? (
          <EmptyState icon={Gift} title="No bundles yet" description="Combine services into a package, like a Startup Launch Pack." />
        ) : (
          <ul className="divide-y divide-border">
            {bundles.map((bundle) => {
              const saving = (bundle.value_of_services ?? 0) - bundle.price;
              const unavailable = bundle.services?.some((service) => !service.is_active);
              return (
                <li key={bundle.id} className={cn("flex items-start gap-4 px-5 py-4 sm:px-6", editingId === bundle.id && "bg-brand-50/40")}>
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white">
                    <Gift className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                      {bundle.name}
                      {!bundle.is_active && <Badge tone="neutral">Hidden</Badge>}
                      {unavailable && <Badge tone="warning">Includes a hidden service</Badge>}
                    </p>
                    <p className="text-sm text-muted">{bundle.services?.map((service) => service.name).join(" + ")}</p>
                    <p className="mt-1 text-sm">
                      <span className="font-semibold text-foreground">{formatNaira(bundle.price)}</span>
                      {saving > 0 && <span className="text-success"> · saves {formatNaira(saving)}</span>}
                      {saving < 0 && <span className="text-warning"> · costs {formatNaira(-saving)} more than buying separately</span>}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" className="size-9" onClick={() => setEditingId(bundle.id)} aria-label={`Edit ${bundle.name}`}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 hover:bg-danger-soft hover:text-danger"
                      onClick={() => remove(bundle)}
                      disabled={deleting}
                      aria-label={`Delete ${bundle.name}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {editingId !== null && <BundleForm key={editingId} bundle={editing} services={services} onDone={() => setEditingId(null)} />}
    </div>
  );
}

function BundleForm({ bundle, services, onDone }: { bundle?: Bundle; services: Service[]; onDone: () => void }) {
  const [name, setName] = useState(bundle?.name ?? "");
  const [summary, setSummary] = useState(bundle?.summary ?? "");
  const [description, setDescription] = useState(bundle?.description ?? "");
  const [price, setPrice] = useState(bundle ? String(bundle.price / 100) : "");
  const [isActive, setIsActive] = useState(bundle?.is_active ?? true);
  const [serviceIds, setServiceIds] = useState<number[]>(bundle?.services?.map((service) => service.id) ?? []);
  const [result, setResult] = useState<FormState>({});
  const [saving, startSaving] = useTransition();

  const chosen = serviceIds.map((id) => services.find((service) => service.id === id)).filter((service): service is Service => Boolean(service));
  const value = chosen.reduce((sum, service) => sum + service.total_fee, 0);
  const priceKobo = Math.round(Number(price.replace(/[₦,\s]/g, "")) * 100) || 0;
  const error = (key: string) => result.errors?.[key];

  function move(index: number, direction: -1 | 1) {
    const next = [...serviceIds];
    [next[index], next[index + direction]] = [next[index + direction]!, next[index]!];
    setServiceIds(next);
  }

  function submit() {
    startSaving(async () => {
      const response = await saveBundle(bundle?.id ?? null, { name, summary, description, price, is_active: isActive, service_ids: serviceIds });
      setResult(response);
      if (response.ok) {
        toast.success(response.message);
        onDone();
      } else {
        toast.error(response.message ?? "Please check the highlighted fields.");
      }
    });
  }

  const serviceError = error("service_ids")?.[0] ?? Object.entries(result.errors ?? {}).find(([key]) => key.startsWith("service_ids."))?.[1][0];

  return (
    <Card className="xl:sticky xl:top-24">
      <CardHeader title={bundle ? `Edit ${bundle.name}` : "New bundle"} />
      <div className="space-y-5 p-5">
        <TextField label="Name" name="name" value={name} onChange={(event) => setName(event.target.value)} error={error("name")} autoFocus />
        <TextareaField label="Summary" name="summary" rows={2} maxLength={300} value={summary} onChange={(event) => setSummary(event.target.value)} error={error("summary")} />
        <TextareaField label="Description (optional)" name="description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />

        <div>
          <p className="text-sm font-medium text-foreground">Included services</p>
          {chosen.length > 0 && (
            <ol className="mt-2 space-y-2">
              {chosen.map((service, index) => (
                <li key={service.id} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">{service.name}</span>
                  <span className="text-muted">{formatNaira(service.total_fee)}</span>
                  <button type="button" disabled={index === 0} onClick={() => move(index, -1)} className="text-muted disabled:opacity-30" aria-label={`Move ${service.name} up`}>
                    <ArrowUp className="size-4" />
                  </button>
                  <button type="button" disabled={index === chosen.length - 1} onClick={() => move(index, 1)} className="text-muted disabled:opacity-30" aria-label={`Move ${service.name} down`}>
                    <ArrowDown className="size-4" />
                  </button>
                  <button type="button" onClick={() => setServiceIds(serviceIds.filter((id) => id !== service.id))} className="text-muted hover:text-danger" aria-label={`Remove ${service.name}`}>
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ol>
          )}
          <select
            aria-label="Add a service to the bundle"
            value=""
            onChange={(event) => event.target.value && setServiceIds([...serviceIds, Number(event.target.value)])}
            className="mt-2 h-11 w-full rounded-xl border border-dashed border-border bg-surface px-3 text-sm text-foreground"
          >
            <option value="">+ Add a service…</option>
            {services
              .filter((service) => !serviceIds.includes(service.id))
              .map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} ({formatNaira(service.total_fee)}){service.is_active ? "" : " (hidden)"}
                </option>
              ))}
          </select>
          {serviceError && <p className="mt-1.5 text-[13px] text-danger">{serviceError}</p>}
        </div>

        <TextField label="Bundle price" name="price" leading="₦" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} error={error("price")} />
        {chosen.length > 0 && (
          <Alert tone={priceKobo > 0 && priceKobo < value ? "success" : "warning"} icon={AlertCircle}>
            Bought separately: {formatNaira(value)}.{" "}
            {priceKobo > 0 && priceKobo < value ? `Customers save ${formatNaira(value - priceKobo)}.` : "Set a price below this so the bundle is worth it."}
          </Alert>
        )}
        <SwitchField name="is_active" label="Visible to customers" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />

        <div className="flex gap-2">
          <Button className="flex-1" onClick={submit} disabled={saving}>
            {saving ? <DotLoader className="text-current" /> : bundle ? "Save bundle" : "Create bundle"}
          </Button>
          <Button variant="outline" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </div>
    </Card>
  );
}
