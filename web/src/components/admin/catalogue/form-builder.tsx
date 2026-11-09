"use client";

import { useState } from "react";
import {
  AlertCircle,
  AlignLeft,
  ArrowDown,
  ArrowUp,
  AtSign,
  Calendar,
  CheckSquare,
  ChevronDown,
  CircleDot,
  Hash,
  ListFilter,
  Phone,
  Plus,
  Trash2,
  Type,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";
import { saveFormFields } from "@/lib/actions/catalogue";
import type { FieldTypeName, FormField } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Alert, Badge, Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DotLoader } from "@/components/ui/loader";
import { SelectField, SwitchField, TextField, TextareaField } from "@/components/ui/form";
import { useListEditor } from "./use-list-editor";

export type FieldTypeOption = { name: FieldTypeName; label: string; needs_options: boolean };

const typeIcons: Record<FieldTypeName, LucideIcon> = {
  text: Type,
  textarea: AlignLeft,
  number: Hash,
  email: AtSign,
  phone: Phone,
  date: Calendar,
  select: ListFilter,
  radio: CircleDot,
  checkbox: CheckSquare,
  file: Upload,
  people: Users,
};

const supportsPlaceholder = new Set<FieldTypeName>(["text", "textarea", "number", "email", "phone"]);

/** "Proposed business name" -> "proposed_business_name", unique within the form. */
function keyFromLabel(label: string, taken: string[]): string {
  let base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
  if (!base) base = "field";
  if (/^\d/.test(base)) base = `f_${base}`;
  let key = base;
  for (let suffix = 2; taken.includes(key); suffix++) key = `${base}_${suffix}`;
  return key;
}

type EditorField = FormField & { keyTouched?: boolean };

export function FormBuilder({ serviceId, initial, fieldTypes }: { serviceId: number; initial: FormField[]; fieldTypes: FieldTypeOption[] }) {
  const editor = useListEditor<EditorField>({
    initial: initial.map((field) => ({ ...field, keyTouched: true })),
    save: (fields) =>
      saveFormFields(
        serviceId,
        fields.map(({ keyTouched: _touched, ...field }) => ({ ...field, options: field.options.map((option) => option.trim()).filter(Boolean) })),
      ),
    fromService: (service) => (service.form_fields ?? []).map((field) => ({ ...field, keyTouched: true })),
    errorPrefix: "fields",
  });
  const [openUid, setOpenUid] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const needsOptions = (type: FieldTypeName) => fieldTypes.find((option) => option.name === type)?.needs_options ?? false;

  function addField(type: FieldTypeName) {
    const uid = editor.add({
      key: keyFromLabel(type, editor.rows.map((row) => row.key)),
      label: "",
      type,
      options: needsOptions(type) ? ["Option 1", "Option 2"] : [],
      placeholder: null,
      help_text: null,
      is_required: true,
      keyTouched: false,
    });
    setOpenUid(uid);
    setPicking(false);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px] xl:items-start">
      <Card>
        <CardHeader
          title="Intake form"
          description="The questions customers answer when they order this service."
          action={<SaveBar dirty={editor.dirty} saving={editor.saving} onSave={editor.save} />}
        />
        <div className="space-y-3 p-4 sm:p-5">
          {editor.listError && (
            <Alert tone="danger" icon={AlertCircle}>
              {editor.listError}
            </Alert>
          )}

          {editor.rows.length === 0 && (
            <EmptyState icon={ListFilter} title="No questions yet" description="Add the details you need from the customer, like proposed names or directors." className="py-10" />
          )}

          <ol className="space-y-3">
            {editor.rows.map((field, index) => {
              const Icon = typeIcons[field.type];
              const errors = editor.errorsFor(field.uid);
              const open = openUid === field.uid || Object.keys(errors).length > 0;
              const typeLabel = fieldTypes.find((option) => option.name === field.type)?.label ?? field.type;

              return (
                <li key={field.uid} className={cn("rounded-xl border bg-surface", Object.keys(errors).length ? "border-danger" : "border-border")}>
                  <div className="flex items-center gap-2 p-2.5 sm:gap-3 sm:p-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-foreground">
                      <Icon className="size-4" />
                    </span>
                    <button type="button" onClick={() => setOpenUid(open ? null : field.uid)} className="min-w-0 flex-1 text-left" aria-expanded={open}>
                      <span className="flex items-center gap-2">
                        <span className={cn("truncate font-semibold", field.label ? "text-foreground" : "text-muted italic")}>{field.label || "Untitled question"}</span>
                        {field.is_required && <Badge tone="brand">Required</Badge>}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {typeLabel} · <code className="font-mono">{field.key}</code>
                      </span>
                    </button>
                    <RowActions
                      label={field.label || "question"}
                      first={index === 0}
                      last={index === editor.rows.length - 1}
                      onUp={() => editor.move(field.uid, -1)}
                      onDown={() => editor.move(field.uid, 1)}
                      onRemove={() => editor.remove(field.uid)}
                    />
                    <button
                      type="button"
                      onClick={() => setOpenUid(open ? null : field.uid)}
                      className="hidden size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-muted sm:flex"
                      aria-label={open ? "Collapse" : "Edit"}
                    >
                      <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
                    </button>
                  </div>

                  {open && (
                    <div className="grid gap-4 border-t border-border p-4 sm:grid-cols-2">
                      <TextField
                        label="Question"
                        name={`label-${field.uid}`}
                        value={field.label}
                        autoFocus={!field.label}
                        error={errors.label ? [errors.label] : undefined}
                        onChange={(event) => {
                          const label = event.target.value;
                          const taken = editor.rows.filter((row) => row.uid !== field.uid).map((row) => row.key);
                          editor.update(field.uid, field.keyTouched ? { label } : { label, key: keyFromLabel(label, taken) });
                        }}
                        placeholder="e.g. Proposed business name"
                      />
                      <SelectField
                        label="Answer type"
                        name={`type-${field.uid}`}
                        value={field.type}
                        error={errors.type ? [errors.type] : undefined}
                        onChange={(event) => {
                          const type = event.target.value as FieldTypeName;
                          editor.update(field.uid, {
                            type,
                            options: needsOptions(type) && field.options.length < 2 ? ["Option 1", "Option 2"] : field.options,
                          });
                        }}
                      >
                        {fieldTypes.map((option) => (
                          <option key={option.name} value={option.name}>
                            {option.label}
                          </option>
                        ))}
                      </SelectField>

                      {needsOptions(field.type) && (
                        <TextareaField
                          className="sm:col-span-2"
                          label="Options (one per line)"
                          name={`options-${field.uid}`}
                          rows={4}
                          value={field.options.join("\n")}
                          error={errors.options ? [errors.options] : undefined}
                          onChange={(event) => editor.update(field.uid, { options: event.target.value.split("\n") })}
                        />
                      )}
                      {supportsPlaceholder.has(field.type) && (
                        <TextField
                          label="Placeholder (optional)"
                          name={`placeholder-${field.uid}`}
                          value={field.placeholder ?? ""}
                          onChange={(event) => editor.update(field.uid, { placeholder: event.target.value || null })}
                        />
                      )}
                      <TextField
                        label="Help text (optional)"
                        name={`help-${field.uid}`}
                        value={field.help_text ?? ""}
                        onChange={(event) => editor.update(field.uid, { help_text: event.target.value || null })}
                        className={supportsPlaceholder.has(field.type) ? undefined : "sm:col-span-2"}
                      />
                      <TextField
                        label="Key"
                        name={`key-${field.uid}`}
                        value={field.key}
                        error={errors.key ? [errors.key] : undefined}
                        onChange={(event) => editor.update(field.uid, { key: event.target.value.toLowerCase(), keyTouched: true })}
                        hint="Used to store the answer. Lowercase letters, numbers and underscores."
                        inputClassName="font-mono"
                      />
                      <div className="flex items-center sm:pt-6">
                        <SwitchField
                          className="w-full"
                          name={`required-${field.uid}`}
                          label="Required"
                          checked={field.is_required}
                          onChange={(event) => editor.update(field.uid, { is_required: event.target.checked })}
                        />
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          {picking ? (
            <div className="rounded-xl border border-dashed border-brand-500/50 bg-brand-50/40 p-3">
              <p className="mb-3 px-1 text-sm font-semibold text-foreground">Choose an answer type</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {fieldTypes.map((option) => {
                  const Icon = typeIcons[option.name];
                  return (
                    <button
                      key={option.name}
                      type="button"
                      onClick={() => addField(option.name)}
                      className="flex items-center gap-2.5 rounded-lg border border-border bg-surface px-3 py-2.5 text-left text-sm font-medium text-foreground transition hover:border-brand-500"
                    >
                      <Icon className="size-4 shrink-0 text-brand-500" />
                      <span className="truncate">{option.label}</span>
                    </button>
                  );
                })}
              </div>
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => setPicking(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="outline" className="w-full border-dashed" onClick={() => setPicking(true)}>
              <Plus className="size-4" /> Add question
            </Button>
          )}
        </div>
      </Card>

      <FormPreview fields={editor.rows} />
    </div>
  );
}

/** Read-only rendering of the form as the customer will see it. */
function FormPreview({ fields }: { fields: FormField[] }) {
  const control = "w-full rounded-xl border border-border bg-surface px-3 text-sm text-muted";
  return (
    <Card className="xl:sticky xl:top-24">
      <CardHeader title="Customer preview" description="Updates as you edit." />
      <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5" aria-label="Preview of the intake form" inert>
        {fields.length === 0 && <p className="text-sm text-muted">Questions will appear here.</p>}
        {fields.map((field, index) => (
          <div key={`${field.key}-${index}`} className="space-y-1.5">
            {field.type !== "checkbox" && (
              <p className="text-sm font-medium text-foreground">
                {field.label || "Untitled question"}
                {field.is_required && <span className="text-brand-600"> *</span>}
              </p>
            )}
            {(() => {
              switch (field.type) {
                case "textarea":
                  return <div className={cn(control, "h-20 py-2")}>{field.placeholder}</div>;
                case "select":
                  return (
                    <div className={cn(control, "flex h-10 items-center justify-between")}>
                      {field.options.filter(Boolean)[0] ?? "Choose…"} <ChevronDown className="size-4" />
                    </div>
                  );
                case "radio":
                  return (
                    <div className="space-y-1.5">
                      {field.options.filter(Boolean).map((option) => (
                        <p key={option} className="flex items-center gap-2 text-sm text-foreground">
                          <span className="size-4 rounded-full border-2 border-navy-200" /> {option}
                        </p>
                      ))}
                    </div>
                  );
                case "checkbox":
                  return (
                    <p className="flex items-center gap-2 text-sm text-foreground">
                      <span className="size-4 rounded border-2 border-navy-200" /> {field.label || "Untitled question"}
                      {field.is_required && <span className="text-brand-600">*</span>}
                    </p>
                  );
                case "file":
                  return (
                    <div className="flex h-16 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-sm text-muted">
                      <Upload className="size-4" /> Upload a file
                    </div>
                  );
                case "people":
                  return (
                    <div className="rounded-xl border border-border p-3 text-sm text-muted">
                      <p className="flex items-center gap-2 font-medium text-foreground">
                        <Users className="size-4 text-brand-500" /> Person 1
                      </p>
                      <p className="mt-1 text-xs">Full name · Email · Phone · ID number</p>
                      <p className="mt-2 text-xs font-semibold text-brand-600">+ Add another person</p>
                    </div>
                  );
                case "date":
                  return (
                    <div className={cn(control, "flex h-10 items-center justify-between")}>
                      dd/mm/yyyy <Calendar className="size-4" />
                    </div>
                  );
                default:
                  return <div className={cn(control, "flex h-10 items-center")}>{field.placeholder}</div>;
              }
            })()}
            {field.help_text && <p className="text-xs text-muted">{field.help_text}</p>}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function RowActions({
  label,
  first,
  last,
  onUp,
  onDown,
  onRemove,
}: {
  label: string;
  first: boolean;
  last: boolean;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
}) {
  const button = "flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground disabled:opacity-30";
  return (
    <div className="flex shrink-0 items-center">
      <button type="button" className={button} onClick={onUp} disabled={first} aria-label={`Move ${label} up`}>
        <ArrowUp className="size-4" />
      </button>
      <button type="button" className={button} onClick={onDown} disabled={last} aria-label={`Move ${label} down`}>
        <ArrowDown className="size-4" />
      </button>
      <button type="button" className={cn(button, "hover:bg-danger-soft hover:text-danger")} onClick={onRemove} aria-label={`Remove ${label}`}>
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

export function SaveBar({ dirty, saving, onSave }: { dirty: boolean; saving: boolean; onSave: () => void }) {
  return (
    <div className="flex items-center gap-3">
      {dirty && !saving && <span className="hidden text-xs font-medium text-warning sm:inline">Unsaved changes</span>}
      <Button size="sm" onClick={onSave} disabled={!dirty || saving}>
        {saving ? <DotLoader className="text-current" /> : "Save"}
      </Button>
    </div>
  );
}
