"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Info, Plus, Trash2, Upload, UserRound } from "lucide-react";
import { toast } from "sonner";
import { placeOrder } from "@/lib/actions/orders";
import type { FormField, Person, Service } from "@/lib/types";
import { cn, formatNaira } from "@/lib/utils";
import { Alert, Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DotLoader } from "@/components/ui/loader";
import { SelectField, TextField, TextareaField } from "@/components/ui/form";

type Answers = Record<string, unknown>;

const emptyPerson = (): Person => ({ full_name: "", email: "", phone: "", id_number: "" });

/** The service's intake form, rendered from the questions an admin built. */
export function OrderForm({ service }: { service: Service }) {
  const fields = service.form_fields ?? [];
  const [answers, setAnswers] = useState<Answers>(() =>
    Object.fromEntries(fields.map((field) => [field.key, field.type === "people" ? [emptyPerson()] : field.type === "checkbox" ? false : ""])),
  );
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();

  const set = (key: string, value: unknown) => setAnswers((current) => ({ ...current, [key]: value }));
  const errorFor = (key: string) => errors[`answers.${key}`];

  function submit() {
    setMessage(null);
    startSubmit(async () => {
      // Send empty strings as null so optional questions validate.
      const payload = Object.fromEntries(
        Object.entries(answers).map(([key, value]) => [
          key,
          Array.isArray(value) ? value.filter((person: Person) => person.full_name.trim() || person.email || person.phone) : value === "" ? null : value,
        ]),
      );
      const result = await placeOrder(service.slug, payload);
      // On success the action redirects to the new order.
      if (result && !result.ok) {
        setErrors(result.errors ?? {});
        setMessage(result.message ?? "Some answers need attention.");
        toast.error(result.message ?? "Some answers need attention.");
        const first = Object.keys(result.errors ?? {})[0];
        if (first) document.querySelector(`[data-field="${first.split(".")[1]}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
      <Card>
        <CardHeader title="Tell us about your order" description="We'll use these details to file on your behalf. Fields marked * are required." />
        <div className="space-y-6 p-5 sm:p-6">
          {message && (
            <Alert tone="danger" icon={AlertCircle}>
              {message}
            </Alert>
          )}
          {fields.length === 0 && <p className="text-sm text-muted">No questions for this service. Just place the order.</p>}
          {fields.map((field) => (
            <div key={field.key} data-field={field.key}>
              <FieldInput field={field} value={answers[field.key]} onChange={(value) => set(field.key, value)} error={errorFor(field.key)} errors={errors} />
            </div>
          ))}
        </div>
      </Card>

      <Card className="xl:sticky xl:top-24">
        <CardHeader title={service.name} />
        <div className="space-y-4 p-5">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Service fee</dt>
              <dd className="font-medium text-foreground">{formatNaira(service.service_fee)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Government fees</dt>
              <dd className="font-medium text-foreground">{service.government_fee ? formatNaira(service.government_fee) : "None"}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2">
              <dt className="font-semibold text-foreground">Total</dt>
              <dd className="font-display text-xl font-extrabold text-foreground">{formatNaira(service.total_fee)}</dd>
            </div>
          </dl>
          {(service.document_requirements?.length ?? 0) > 0 && (
            <Alert tone="info" icon={Info}>
              Next you&apos;ll upload {service.document_requirements!.length} document{service.document_requirements!.length === 1 ? "" : "s"} and pay.
            </Alert>
          )}
          <Button size="lg" className="w-full" onClick={submit} disabled={submitting}>
            {submitting ? <DotLoader className="text-current" /> : "Continue"}
          </Button>
          <p className="text-center text-xs text-muted">You won&apos;t be charged until you pay the invoice.</p>
        </div>
      </Card>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  error,
  errors,
}: {
  field: FormField;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string[];
  errors: Record<string, string[]>;
}) {
  const label = `${field.label}${field.is_required ? " *" : ""}`;
  const common = { name: field.key, error, hint: field.help_text ?? undefined };

  switch (field.type) {
    case "textarea":
      return <TextareaField label={label} rows={4} placeholder={field.placeholder ?? undefined} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} {...common} />;
    case "select":
      return (
        <SelectField label={label} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} {...common}>
          <option value="">Choose…</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </SelectField>
      );
    case "radio":
      return (
        <fieldset>
          <legend className="text-sm font-medium text-foreground">{label}</legend>
          {field.help_text && <p className="text-[13px] text-muted">{field.help_text}</p>}
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {field.options.map((option) => (
              <label key={option} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm", value === option ? "border-brand-500 bg-brand-50/50" : "border-border")}>
                <input type="radio" name={field.key} value={option} checked={value === option} onChange={() => onChange(option)} className="size-4 accent-[#f05a28]" />
                {option}
              </label>
            ))}
          </div>
          {error && <p className="mt-1.5 text-[13px] text-danger">{error[0]}</p>}
        </fieldset>
      );
    case "checkbox":
      return (
        <div>
          <label className="flex cursor-pointer items-start gap-3 text-sm text-foreground">
            <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 size-4 accent-[#f05a28]" />
            <span>
              {label}
              {field.help_text && <span className="block text-[13px] text-muted">{field.help_text}</span>}
            </span>
          </label>
          {error && <p className="mt-1.5 text-[13px] text-danger">{error[0]}</p>}
        </div>
      );
    case "file":
      return (
        <div className="flex items-start gap-3 rounded-xl border border-dashed border-border p-4 text-sm">
          <Upload className="mt-0.5 size-4 shrink-0 text-brand-500" />
          <span>
            <span className="font-medium text-foreground">{label}</span>
            <span className="block text-muted">You&apos;ll upload this on the next screen, together with your documents.</span>
          </span>
        </div>
      );
    case "people":
      return <PeopleInput field={field} people={(value as Person[]) ?? []} onChange={onChange} error={error} errors={errors} />;
    default:
      return (
        <TextField
          label={label}
          type={field.type === "email" ? "email" : field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "phone" ? "tel" : "text"}
          placeholder={field.placeholder ?? undefined}
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          {...common}
        />
      );
  }
}

/** Repeating group for directors, shareholders, proprietors or trustees. */
function PeopleInput({ field, people, onChange, error, errors }: { field: FormField; people: Person[]; onChange: (value: Person[]) => void; error?: string[]; errors: Record<string, string[]> }) {
  const update = (index: number, patch: Partial<Person>) => onChange(people.map((person, i) => (i === index ? { ...person, ...patch } : person)));

  return (
    <fieldset>
      <legend className="text-sm font-medium text-foreground">
        {field.label}
        {field.is_required && " *"}
      </legend>
      {field.help_text && <p className="text-[13px] text-muted">{field.help_text}</p>}
      <div className="mt-2 space-y-3">
        {people.map((person, index) => {
          const err = (name: string) => errors[`answers.${field.key}.${index}.${name}`];
          return (
            <div key={index} className="rounded-xl border border-border p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <UserRound className="size-4 text-brand-500" /> Person {index + 1}
                </p>
                {people.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => onChange(people.filter((_, i) => i !== index))} aria-label={`Remove person ${index + 1}`}>
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Full name *" name={`${field.key}-${index}-name`} value={person.full_name} onChange={(event) => update(index, { full_name: event.target.value })} error={err("full_name")} />
                <TextField label="Email" name={`${field.key}-${index}-email`} type="email" value={person.email ?? ""} onChange={(event) => update(index, { email: event.target.value })} error={err("email")} />
                <TextField label="Phone" name={`${field.key}-${index}-phone`} type="tel" value={person.phone ?? ""} onChange={(event) => update(index, { phone: event.target.value })} error={err("phone")} />
                <TextField label="NIN / ID number" name={`${field.key}-${index}-id`} value={person.id_number ?? ""} onChange={(event) => update(index, { id_number: event.target.value })} error={err("id_number")} />
              </div>
            </div>
          );
        })}
      </div>
      {error && <p className="mt-1.5 text-[13px] text-danger">{error[0]}</p>}
      <Button variant="outline" size="sm" className="mt-3" onClick={() => onChange([...people, emptyPerson()])}>
        <Plus className="size-4" /> Add another person
      </Button>
    </fieldset>
  );
}
