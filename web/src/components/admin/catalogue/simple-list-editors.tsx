"use client";

import { AlertCircle, CircleDot, EyeOff, FileText, Plus } from "lucide-react";
import { saveRequirements, saveStages } from "@/lib/actions/catalogue";
import type { DocumentRequirement, ServiceStage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Alert, Badge, Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SwitchField, TextField } from "@/components/ui/form";
import { RowActions, SaveBar } from "./form-builder";
import { useListEditor } from "./use-list-editor";

export function RequirementsEditor({ serviceId, initial }: { serviceId: number; initial: DocumentRequirement[] }) {
  const editor = useListEditor<DocumentRequirement>({
    initial,
    save: (requirements) => saveRequirements(serviceId, requirements),
    fromService: (service) => service.document_requirements ?? [],
    errorPrefix: "requirements",
  });

  return (
    <Card className="max-w-4xl">
      <CardHeader
        title="Required documents"
        description="What the customer uploads when ordering. Staff will accept or reject each one."
        action={<SaveBar dirty={editor.dirty} saving={editor.saving} onSave={editor.save} />}
      />
      <div className="space-y-3 p-4 sm:p-5">
        {editor.listError && (
          <Alert tone="danger" icon={AlertCircle}>
            {editor.listError}
          </Alert>
        )}
        {editor.rows.length === 0 && (
          <EmptyState icon={FileText} title="No documents required" description="Add IDs, photos, certificates or anything else you need." className="py-10" />
        )}
        <ol className="space-y-3">
          {editor.rows.map((row, index) => {
            const errors = editor.errorsFor(row.uid);
            return (
              <li key={row.uid} className={cn("rounded-xl border p-4", errors.label ? "border-danger" : "border-border")}>
                <div className="flex items-start gap-3">
                  <span className="mt-7 flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <FileText className="size-4" />
                  </span>
                  <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                    <TextField
                      label="Document"
                      name={`label-${row.uid}`}
                      value={row.label}
                      autoFocus={!row.label}
                      error={errors.label ? [errors.label] : undefined}
                      onChange={(event) => editor.update(row.uid, { label: event.target.value })}
                      placeholder="e.g. Valid means of ID"
                    />
                    <TextField
                      label="Guidance (optional)"
                      name={`description-${row.uid}`}
                      value={row.description ?? ""}
                      onChange={(event) => editor.update(row.uid, { description: event.target.value || null })}
                      placeholder="e.g. NIN slip or international passport"
                    />
                    <SwitchField
                      name={`required-${row.uid}`}
                      label="Required"
                      checked={row.is_required}
                      onChange={(event) => editor.update(row.uid, { is_required: event.target.checked })}
                    />
                  </div>
                  <div className="mt-6">
                    <RowActions
                      label={row.label || "document"}
                      first={index === 0}
                      last={index === editor.rows.length - 1}
                      onUp={() => editor.move(row.uid, -1)}
                      onDown={() => editor.move(row.uid, 1)}
                      onRemove={() => editor.remove(row.uid)}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        <Button variant="outline" className="w-full border-dashed" onClick={() => editor.add({ label: "", description: null, is_required: true })}>
          <Plus className="size-4" /> Add document
        </Button>
      </div>
    </Card>
  );
}

export function StagesEditor({ serviceId, initial }: { serviceId: number; initial: ServiceStage[] }) {
  const editor = useListEditor<ServiceStage>({
    initial,
    save: (stages) => saveStages(serviceId, stages),
    fromService: (service) => service.stages ?? [],
    errorPrefix: "stages",
  });

  return (
    <Card className="max-w-4xl">
      <CardHeader
        title="Stages"
        description="The steps an order moves through. Customers follow visible stages on their order timeline."
        action={<SaveBar dirty={editor.dirty} saving={editor.saving} onSave={editor.save} />}
      />
      <div className="p-4 sm:p-5">
        {editor.listError && (
          <Alert tone="danger" icon={AlertCircle} className="mb-3">
            {editor.listError}
          </Alert>
        )}
        {editor.rows.length === 0 && (
          <EmptyState icon={CircleDot} title="Add at least one stage" description="For example: Documents received, Filed with CAC, Certificate issued." className="py-10" />
        )}
        <ol>
          {editor.rows.map((row, index) => {
            const errors = editor.errorsFor(row.uid);
            return (
              <li key={row.uid} className="relative flex gap-4 pb-4 last:pb-0">
                {index < editor.rows.length - 1 && <span className="absolute left-[17px] top-11 h-[calc(100%-36px)] w-0.5 bg-navy-100" aria-hidden />}
                <span
                  className={cn(
                    "relative z-10 mt-7 flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                    row.customer_visible ? "bg-navy-900 text-white dark:bg-navy-700" : "border-2 border-dashed border-navy-200 text-muted",
                  )}
                >
                  {index + 1}
                </span>
                <div className={cn("min-w-0 flex-1 rounded-xl border p-4", errors.name ? "border-danger" : "border-border")}>
                  <div className="flex items-start gap-3">
                    <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                      <TextField
                        label="Stage name"
                        name={`name-${row.uid}`}
                        value={row.name}
                        autoFocus={!row.name}
                        error={errors.name ? [errors.name] : undefined}
                        onChange={(event) => editor.update(row.uid, { name: event.target.value })}
                        placeholder="e.g. Filed with CAC"
                      />
                      <TextField
                        label="Description (optional)"
                        name={`description-${row.uid}`}
                        value={row.description ?? ""}
                        onChange={(event) => editor.update(row.uid, { description: event.target.value || null })}
                      />
                      <SwitchField
                        name={`visible-${row.uid}`}
                        label="Visible to customer"
                        description={row.customer_visible ? undefined : "Internal step, hidden from the order timeline."}
                        checked={row.customer_visible}
                        onChange={(event) => editor.update(row.uid, { customer_visible: event.target.checked })}
                      />
                      {!row.customer_visible && (
                        <div className="flex items-center">
                          <Badge tone="neutral">
                            <EyeOff className="size-3" /> Staff only
                          </Badge>
                        </div>
                      )}
                    </div>
                    <div className="mt-6">
                      <RowActions
                        label={row.name || "stage"}
                        first={index === 0}
                        last={index === editor.rows.length - 1}
                        onUp={() => editor.move(row.uid, -1)}
                        onDown={() => editor.move(row.uid, 1)}
                        onRemove={() => editor.remove(row.uid)}
                      />
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        <Button variant="outline" className="mt-4 w-full border-dashed" onClick={() => editor.add({ name: "", description: null, customer_visible: true })}>
          <Plus className="size-4" /> Add stage
        </Button>
      </div>
    </Card>
  );
}
