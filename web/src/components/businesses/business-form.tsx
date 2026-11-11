"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveBusiness } from "@/lib/actions/businesses";
import type { Business, EntityType } from "@/lib/types";
import { Button, ButtonLink } from "@/components/ui/button";
import { SelectField, SwitchField, TextField } from "@/components/ui/form";
import { DotLoader } from "@/components/ui/loader";

const types: { value: EntityType; label: string; hint: string }[] = [
  { value: "business_name", label: "Business Name (BN)", hint: "A sole trader or partnership registered with CAC." },
  { value: "company", label: "Limited company (LTD)", hint: "A private company limited by shares." },
  { value: "trustees", label: "Incorporated Trustees", hint: "An NGO, church, club or association." },
];

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const states = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu",
  "FCT Abuja", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo",
  "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
];

/** Add or edit a business. Its type and taxes decide the deadlines on its calendar. */
export function BusinessForm({ business }: { business?: Business }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: business?.name ?? "",
    entity_type: business?.entity_type ?? ("business_name" as EntityType),
    registration_number: business?.registration_number ?? "",
    registered_on: business?.registered_on ?? "",
    tin: business?.tin ?? "",
    vat_registered: business?.vat_registered ?? false,
    has_employees: business?.has_employees ?? false,
    financial_year_end_month: String(business?.financial_year_end_month ?? 12),
    state: business?.state ?? "Akwa Ibom",
    industry: business?.industry ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, startSaving] = useTransition();
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [key]: event.target.value });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startSaving(async () => {
      const result = await saveBusiness(business?.id ?? null, {
        name: form.name.trim(),
        entity_type: form.entity_type,
        registration_number: form.registration_number.trim() || null,
        registered_on: form.registered_on || null,
        tin: form.tin.trim() || null,
        vat_registered: form.vat_registered,
        has_employees: form.has_employees,
        financial_year_end_month: Number(form.financial_year_end_month),
        state: form.state || null,
        industry: form.industry.trim() || null,
      });
      setErrors(result.errors ?? {});
      if (result.ok) {
        toast.success(result.message);
        router.push(`/dashboard/businesses/${result.id}`);
      } else {
        toast.error(result.message ?? "Please fix the highlighted fields.");
      }
    });
  }

  const typeHint = types.find((type) => type.value === form.entity_type)?.hint;

  return (
    <form noValidate onSubmit={submit} className="space-y-6 p-5 sm:p-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Business name" name="name" value={form.name} onChange={set("name")} error={errors.name} required className="sm:col-span-2" placeholder="e.g. Amara Foods" />
        <SelectField label="Type" name="entity_type" value={form.entity_type} onChange={set("entity_type")} error={errors.entity_type} hint={typeHint}>
          {types.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </SelectField>
        <TextField
          label="CAC registration number"
          name="registration_number"
          value={form.registration_number}
          onChange={set("registration_number")}
          error={errors.registration_number}
          placeholder={form.entity_type === "company" ? "RC 1234567" : form.entity_type === "trustees" ? "IT 123456" : "BN 3456789"}
          hint="Leave empty if it's still being registered."
        />
        <TextField
          label="Date registered"
          name="registered_on"
          type="date"
          value={form.registered_on}
          onChange={set("registered_on")}
          error={errors.registered_on}
          hint="On your CAC certificate. We use it to work out your annual returns."
        />
        <TextField label="Tax identification number (TIN)" name="tin" value={form.tin} onChange={set("tin")} error={errors.tin} placeholder="12345678-0001" inputMode="numeric" />
      </div>

      <div className="space-y-4 rounded-xl border border-border p-4 sm:p-5">
        <p className="text-sm font-semibold text-foreground">Taxes you pay</p>
        <SwitchField
          label="Registered for VAT"
          description="You charge VAT and file a return by the 21st of each month."
          checked={form.vat_registered}
          onChange={(event) => setForm({ ...form, vat_registered: event.target.checked })}
        />
        <SwitchField
          label="You have staff on payroll"
          description="You deduct PAYE from salaries and pay it to the state by the 10th of each month."
          checked={form.has_employees}
          onChange={(event) => setForm({ ...form, has_employees: event.target.checked })}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        {form.entity_type === "company" && (
          <SelectField
            label="Financial year ends in"
            name="financial_year_end_month"
            value={form.financial_year_end_month}
            onChange={set("financial_year_end_month")}
            error={errors.financial_year_end_month}
            hint="Usually December."
          >
            {months.map((month, index) => (
              <option key={month} value={index + 1}>
                {month}
              </option>
            ))}
          </SelectField>
        )}
        <SelectField label="State" name="state" value={form.state} onChange={set("state")} error={errors.state}>
          {states.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </SelectField>
        <TextField label="Industry (optional)" name="industry" value={form.industry} onChange={set("industry")} error={errors.industry} placeholder="e.g. Food processing" />
      </div>

      <div className="flex flex-wrap justify-end gap-3">
        <ButtonLink href={business ? `/dashboard/businesses/${business.id}` : "/dashboard/businesses"} variant="ghost">
          Cancel
        </ButtonLink>
        <Button type="submit" disabled={saving}>
          {saving ? <DotLoader className="text-current" label="Saving" /> : business ? "Save changes" : "Add business"}
        </Button>
      </div>
    </form>
  );
}
