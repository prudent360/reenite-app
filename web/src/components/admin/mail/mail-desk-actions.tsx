"use client";

import { useRef, useState, useTransition } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { handleMail, uploadMailScan } from "@/lib/actions/mailbox";
import type { MailItem, MailOutcome } from "@/lib/types";
import { uploadTooLarge } from "@/lib/uploads";
import { Button } from "@/components/ui/button";
import { DotLoader } from "@/components/ui/loader";

const outcomes: { value: MailOutcome; label: string; notePlaceholder: string }[] = [
  { value: "collected", label: "Collected", notePlaceholder: "Who collected it (optional)" },
  { value: "forwarded", label: "Forwarded", notePlaceholder: "Courier and tracking number" },
  { value: "shredded", label: "Shredded", notePlaceholder: "Note (optional)" },
];

/**
 * Front desk actions on a waiting item: add a scan, or mark it collected, forwarded or shredded.
 * The customer's request, if any, is preselected.
 */
export function MailDeskActions({ item }: { item: MailItem }) {
  const suggested: MailOutcome | null = item.requested_action === "collect" ? "collected" : item.requested_action === "forward" ? "forwarded" : item.requested_action === "shred" ? "shredded" : null;
  const [outcome, setOutcome] = useState<MailOutcome | null>(null);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  if (item.status !== "waiting") return null;

  function finish(chosen: MailOutcome) {
    startTransition(async () => {
      const result = await handleMail(item.id, chosen, note.trim());
      if (result.ok) toast.success(result.message);
      else toast.error(result.message ?? "Couldn't update the item.");
    });
  }

  function scan(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const tooLarge = uploadTooLarge(file, "The scan");
    if (tooLarge) {
      toast.error(tooLarge);
      event.target.value = "";
      return;
    }
    const form = new FormData();
    form.set("scan", file);
    startTransition(async () => {
      const result = await uploadMailScan(item.id, form);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message ?? "Upload failed.");
      if (fileInput.current) fileInput.current.value = "";
    });
  }

  if (outcome) {
    const config = outcomes.find((option) => option.value === outcome)!;
    return (
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          finish(outcome);
        }}
      >
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={config.notePlaceholder}
          maxLength={500}
          autoFocus
          aria-label="Note"
          className="h-9 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 text-sm text-foreground focus:border-brand-500 focus:outline-none"
        />
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? <DotLoader className="text-current" label="Saving" /> : `Mark ${config.label.toLowerCase()}`}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setOutcome(null)}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {outcomes.map((option) => (
        <Button key={option.value} variant={suggested === option.value ? "primary" : "outline"} size="sm" disabled={pending} onClick={() => setOutcome(option.value)}>
          {option.label}
        </Button>
      ))}
      <Button variant={item.requested_action === "scan" ? "primary" : "outline"} size="sm" disabled={pending} onClick={() => fileInput.current?.click()}>
        {pending ? <DotLoader className="text-current" label="Working" /> : <><Upload className="size-4" /> {item.has_scan ? "Replace scan" : "Add scan"}</>}
      </Button>
      <input ref={fileInput} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={scan} tabIndex={-1} aria-hidden />
    </div>
  );
}
