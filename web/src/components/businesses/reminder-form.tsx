"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { addReminder } from "@/lib/actions/businesses";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/form";
import { DotLoader } from "@/components/ui/loader";

/** Customers add their own deadlines, e.g. a state permit renewal. */
export function ReminderForm({ businessId }: { businessId: number }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", due_on: "", note: "" });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, startSaving] = useTransition();

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Add a reminder
      </Button>
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startSaving(async () => {
      const result = await addReminder(businessId, { title: form.title.trim(), due_on: form.due_on, note: form.note.trim() || null });
      setErrors(result.errors ?? {});
      if (result.ok) {
        toast.success(result.message);
        setForm({ title: "", due_on: "", note: "" });
        setOpen(false);
      } else if (!result.errors) {
        toast.error(result.message ?? "We couldn't add the reminder.");
      }
    });
  }

  return (
    <form noValidate onSubmit={submit} className="w-full space-y-4 rounded-xl border border-border p-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
        <TextField label="What's due" name="title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} error={errors.title} placeholder="e.g. Renew fire safety certificate" autoFocus />
        <TextField label="Due date" name="due_on" type="date" value={form.due_on} onChange={(event) => setForm({ ...form, due_on: event.target.value })} error={errors.due_on} />
      </div>
      <TextField label="Note (optional)" name="note" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} error={errors.note} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? <DotLoader className="text-current" label="Adding" /> : "Add reminder"}
        </Button>
      </div>
    </form>
  );
}
