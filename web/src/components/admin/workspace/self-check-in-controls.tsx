"use client";

import { useState, useTransition } from "react";
import { AlertCircle, CircleCheck, Copy, Printer, RefreshCw } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { SwitchField } from "@/components/ui/form";
import { regenerateSelfCheckIn, setSelfCheckIn } from "@/lib/actions/check-in";
import type { SelfCheckInSettings } from "@/lib/types";

export function SelfCheckInControls({ settings }: { settings: SelfCheckInSettings }) {
  const [enabled, setEnabled] = useState(settings.enabled);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function toggle(next: boolean) {
    setEnabled(next);
    startTransition(async () => {
      const response = await setSelfCheckIn(settings.location_id, next);
      if (!response.ok) setEnabled(!next);
      setResult({ ok: response.ok === true, message: response.message ?? "" });
    });
  }

  function regenerate() {
    if (!window.confirm("Make a new link? Posters already printed will stop working, so you'll need to print and put up the new one.")) return;
    startTransition(async () => {
      const response = await regenerateSelfCheckIn(settings.location_id);
      setResult({ ok: response.ok === true, message: response.message ?? "" });
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(settings.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setResult({ ok: false, message: "Couldn't copy. Select the link and copy it instead." });
    }
  }

  return (
    <div className="space-y-4">
      <SwitchField
        label="Let customers check themselves in"
        description="They scan the poster at reception, then tap their booking or type their code. Opens 30 minutes before each booking."
        checked={enabled}
        disabled={pending}
        onChange={(event) => toggle(event.target.checked)}
      />
      <div className="flex flex-wrap gap-2">
        <ButtonLink href={`/admin/workspace/locations/${settings.location_id}/poster`} size="sm" variant={enabled ? "primary" : "outline"}>
          <Printer className="size-4" /> Print poster
        </ButtonLink>
        <Button size="sm" variant="outline" onClick={copy}>
          <Copy className="size-4" /> {copied ? "Copied" : "Copy link"}
        </Button>
        <Button size="sm" variant="ghost" onClick={regenerate} disabled={pending}>
          <RefreshCw className="size-4" /> New link
        </Button>
      </div>
      <p className="break-all font-mono text-xs text-muted">{settings.url}</p>
      {result?.message && (
        <Alert tone={result.ok ? "success" : "danger"} icon={result.ok ? CircleCheck : AlertCircle}>
          {result.message}
        </Alert>
      )}
    </div>
  );
}
