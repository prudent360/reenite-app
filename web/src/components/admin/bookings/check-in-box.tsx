"use client";

import { useState, useTransition } from "react";
import { AlertCircle, CircleCheck, ScanLine } from "lucide-react";
import { Alert, Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DotLoader } from "@/components/ui/loader";
import { checkInByCode } from "@/lib/actions/bookings";
import { cn } from "@/lib/utils";

/**
 * Front desk: type the code from the customer's confirmation, or scan the QR code on their pass
 * with a phone camera. The QR code opens this page with `?checkin=CODE`, which arrives here as
 * `initialCode`. Staff still tap "Check in", so opening the link alone never checks anyone in.
 */
export function CheckInBox({ initialCode = "" }: { initialCode?: string }) {
  const [code, setCode] = useState(initialCode.toUpperCase().slice(0, 12));
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!code.trim()) return;
    startTransition(async () => {
      const response = await checkInByCode(code.trim());
      setResult({ ok: response.ok === true, message: response.message ?? (response.ok ? "Checked in." : "Couldn't check in.") });
      if (response.ok) {
        setCode("");
        // Drop ?checkin= so refreshing the page doesn't offer the same code again.
        if (initialCode) window.history.replaceState(null, "", window.location.pathname);
      }
    });
  }

  return (
    <Card className={cn("p-5", initialCode && "ring-2 ring-brand-500/40")}>
      {initialCode && !result && <p className="mb-3 text-sm text-muted">Scanned from a booking pass. Tap Check in to confirm.</p>}
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1 space-y-1.5">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <ScanLine className="size-4 text-brand-500" /> Check someone in
          </span>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="Code from their confirmation, e.g. K7Q2MX"
            autoComplete="off"
            maxLength={12}
            className="h-11 w-full rounded-xl border border-border bg-surface px-3 font-mono text-lg tracking-widest text-foreground placeholder:font-sans placeholder:text-sm placeholder:tracking-normal focus:border-brand-500 focus:outline-none"
          />
        </label>
        <Button type="submit" size="lg" disabled={pending || !code.trim()}>
          {pending ? <DotLoader className="text-current" label="Checking in" /> : "Check in"}
        </Button>
      </form>
      {result && (
        <Alert tone={result.ok ? "success" : "danger"} icon={result.ok ? CircleCheck : AlertCircle} className="mt-4">
          {result.message}
        </Alert>
      )}
    </Card>
  );
}
