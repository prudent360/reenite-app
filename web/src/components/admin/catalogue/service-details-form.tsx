"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { createService, updateService } from "@/lib/actions/catalogue";
import type { FormState, Service, ServiceCategory } from "@/lib/types";
import { formatNaira } from "@/lib/utils";
import { Alert, Card, CardHeader } from "@/components/ui/card";
import { SelectField, SubmitButton, SwitchField, TextField, TextareaField } from "@/components/ui/form";

/** "25000" from 2500000 kobo, for editing. */
function nairaInput(kobo: number | undefined): string {
  return kobo === undefined ? "" : String(kobo / 100);
}

function koboFromInput(value: string): number {
  const amount = Number(value.replace(/[₦,\s]/g, ""));
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

export function ServiceDetailsForm({ service, categories }: { service?: Service; categories: ServiceCategory[] }) {
  const action = service ? updateService.bind(null, service.id) : createService;
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const [serviceFee, setServiceFee] = useState(nairaInput(service?.service_fee));
  const [governmentFee, setGovernmentFee] = useState(nairaInput(service?.government_fee));

  useEffect(() => {
    if (state.ok && state.message) {
      toast.success(state.message);
    }
  }, [state]);

  const total = koboFromInput(serviceFee) + koboFromInput(governmentFee);
  const value = (name: string, fallback: string | number | null | undefined) => state.values?.[name] ?? String(fallback ?? "");

  return (
    <form action={formAction} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start" noValidate>
      <Card>
        <CardHeader title="Details" description="What customers see in the catalogue." />
        <div className="space-y-5 p-5 sm:p-6">
          {state.message && !state.ok && (
            <Alert tone="danger" icon={AlertCircle}>
              {state.message}
            </Alert>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label="Service name" name="name" required defaultValue={value("name", service?.name)} error={state.errors?.name} placeholder="e.g. Business Name Registration" />
            <SelectField
              label="Category"
              name="service_category_id"
              defaultValue={value("service_category_id", service?.service_category_id ?? categories[0]?.id)}
              error={state.errors?.service_category_id}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                  {!category.is_active ? " (hidden)" : ""}
                </option>
              ))}
            </SelectField>
          </div>
          <TextareaField
            label="Short summary"
            name="summary"
            required
            maxLength={300}
            rows={2}
            defaultValue={value("summary", service?.summary)}
            error={state.errors?.summary}
            hint="One sentence shown on the service card. Up to 300 characters."
          />
          <TextareaField
            label="Full description (optional)"
            name="description"
            rows={5}
            defaultValue={value("description", service?.description)}
            error={state.errors?.description}
            hint="Shown on the service page. Line breaks are kept."
          />
          {service && (
            <TextField
              label="URL slug"
              name="slug"
              defaultValue={value("slug", service.slug)}
              error={state.errors?.slug}
              hint={`reenite.com/services/${value("slug", service.slug) || "…"}. Leave blank to generate from the name.`}
            />
          )}
        </div>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Pricing" description="Amounts in naira." />
          <div className="space-y-5 p-5 sm:p-6">
            <TextField
              label="Reenite service fee"
              name="service_fee"
              inputMode="decimal"
              leading="₦"
              value={serviceFee}
              onChange={(event) => setServiceFee(event.target.value)}
              error={state.errors?.service_fee}
              placeholder="0"
            />
            <TextField
              label="Government fees"
              name="government_fee"
              inputMode="decimal"
              leading="₦"
              value={governmentFee}
              onChange={(event) => setGovernmentFee(event.target.value)}
              error={state.errors?.government_fee}
              placeholder="0"
              hint="Paid to CAC, FIRS etc. on the customer's behalf. Shown separately."
            />
            <div className="flex items-center justify-between rounded-xl bg-surface-muted px-4 py-3">
              <span className="text-sm text-muted">Customer pays</span>
              <span className="font-display text-xl font-extrabold text-foreground">{formatNaira(total)}</span>
            </div>
            <TextField
              label="Turnaround (working days)"
              name="turnaround_days"
              type="number"
              min={1}
              max={365}
              defaultValue={value("turnaround_days", service?.turnaround_days)}
              error={state.errors?.turnaround_days}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Availability" />
          <div className="space-y-5 p-5 sm:p-6">
            <SwitchField name="is_active" label="Live in catalogue" description="Hidden services can't be ordered." defaultChecked={service?.is_active ?? false} />
            <SwitchField
              name="requires_business"
              label="Needs an existing business"
              description="For services like annual returns or TIN, where the customer must already be registered."
              defaultChecked={service?.requires_business ?? false}
            />
          </div>
        </Card>

        <SubmitButton size="lg" className="w-full">
          {service ? "Save details" : "Create service"}
        </SubmitButton>
      </div>
    </form>
  );
}
