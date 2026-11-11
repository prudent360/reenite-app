"use client";

import { useState, useTransition } from "react";
import { Check, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { staffSetComplianceStatus } from "@/lib/actions/businesses";
import type { ComplianceItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { DotLoader } from "@/components/ui/loader";

/** Staff record a deadline as dealt with, with an optional note (e.g. "Filed on their behalf"). */
export function ComplianceStaffActions({ item }: { item: ComplianceItem }) {
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState(item.note ?? "");
  const [pending, startTransition] = useTransition();

  function save(status: ComplianceItem["status"]) {
    startTransition(async () => {
      const result = await staffSetComplianceStatus(item.id, status, note.trim() || null);
      if (result.ok) {
        toast.success(result.message);
        setNoting(false);
      } else {
        toast.error(result.message ?? "That didn't work.");
      }
    });
  }

  if (pending) return <DotLoader className="text-navy-300" label="Saving" />;

  if (item.status !== "open") {
    return (
      <Button size="sm" variant="ghost" onClick={() => save("open")}>
        <RotateCcw className="size-4" /> Reopen
      </Button>
    );
  }

  if (noting) {
    return (
      <div className="flex w-full flex-col gap-2 sm:w-72">
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Note, e.g. Filed on their behalf"
          aria-label="Note"
          autoFocus
          className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-foreground focus:border-brand-500 focus:outline-none"
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={() => save("done")}>
            <Check className="size-4" /> Mark done
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setNoting(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button size="sm" variant="outline" onClick={() => setNoting(true)}>
      <Check className="size-4" /> Mark done
    </Button>
  );
}
