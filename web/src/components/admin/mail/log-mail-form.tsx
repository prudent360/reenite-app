"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { logMail } from "@/lib/actions/mailbox";
import { MAX_UPLOAD_LABEL, uploadTooLarge } from "@/lib/uploads";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/form";
import { DotLoader } from "@/components/ui/loader";

/** The front desk records a letter or parcel; the customer is emailed straight away. */
export function LogMailForm({ mailboxId }: { mailboxId: number }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      noValidate
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await logMail(mailboxId, data);
          setErrors(result.errors ?? {});
          if (result.ok) {
            toast.success(result.message);
            formRef.current?.reset();
          } else {
            toast.error(result.message ?? "Please fix the highlighted fields.");
          }
        });
      }}
    >
      <SelectField label="What arrived" name="kind" defaultValue="letter" error={errors.kind}>
        <option value="letter">Letter</option>
        <option value="official">Official letter (CAC, FIRS, court, bank)</option>
        <option value="parcel">Parcel</option>
      </SelectField>
      <TextField label="From (optional)" name="sender" placeholder="e.g. Corporate Affairs Commission" maxLength={150} error={errors.sender} />
      <TextField label="Note (optional)" name="description" placeholder="e.g. Large brown envelope" maxLength={500} error={errors.description} />
      <TextField label="Arrived on" name="received_at" type="date" defaultValue={new Date().toISOString().slice(0, 10)} max={new Date().toISOString().slice(0, 10)} error={errors.received_at} />
      <div className="space-y-1.5">
        <label htmlFor="mail-scan" className="text-sm font-medium text-foreground">
          Scan (optional)
        </label>
        <input
          id="mail-scan"
          name="scan"
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0];
            const tooLarge = file && uploadTooLarge(file, "The scan");
            if (tooLarge) {
              toast.error(tooLarge);
              event.target.value = "";
            }
          }}
          className="block w-full text-xs text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-navy-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-foreground"
        />
        <p className="text-xs text-muted">Only scan the envelope or contents if the customer has agreed to it. PDF or photo, up to {MAX_UPLOAD_LABEL}.</p>
        {errors.scan && <p className="text-[13px] text-danger">{errors.scan[0]}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <DotLoader className="text-current" label="Logging mail" /> : "Log mail and email customer"}
      </Button>
    </form>
  );
}
