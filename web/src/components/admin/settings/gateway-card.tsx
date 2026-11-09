"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Check, CircleCheck, Copy, ExternalLink, PlugZap } from "lucide-react";
import { toast } from "sonner";
import { saveGateway, testGateway } from "@/lib/actions/settings";
import type { PaymentGateway } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import { Alert, Badge, Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DotLoader } from "@/components/ui/loader";
import { SwitchField, TextField } from "@/components/ui/form";

const brandColours: Record<PaymentGateway["code"], string> = {
  paystack: "bg-[#0ba4db]",
  flutterwave: "bg-[#f5a623]",
  stripe: "bg-[#635bff]",
};

export function GatewayCard({ gateway }: { gateway: PaymentGateway }) {
  const [enabled, setEnabled] = useState(gateway.is_enabled);
  const [mode, setMode] = useState(gateway.mode);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, startSaving] = useTransition();
  const [testing, startTesting] = useTransition();
  const [copied, setCopied] = useState(false);

  const fields = gateway.fields[mode];
  const dirty = enabled !== gateway.is_enabled || mode !== gateway.mode || Object.values(values).some((value) => value.trim() !== "");

  function save() {
    startSaving(async () => {
      const result = await saveGateway(gateway.code, { is_enabled: enabled, mode, credentials: { [mode]: values } });
      setErrors(result.errors ?? {});
      if (result.ok) {
        setValues({});
        toast.success(result.message);
      } else {
        toast.error(result.message ?? "Please check the highlighted fields.");
      }
    });
  }

  function test() {
    startTesting(async () => {
      const result = await testGateway(gateway.code);
      if (result.ok) {
        toast.success(result.message);
      } else {
        toast.error(result.message ?? "Connection test failed.");
      }
    });
  }

  async function copyWebhook() {
    try {
      await navigator.clipboard.writeText(gateway.webhook_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Select the URL and copy it manually.");
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start gap-4 border-b border-border p-5 sm:p-6">
        <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-xl font-display text-xl font-extrabold text-white", brandColours[gateway.code])}>
          {gateway.label[0]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-foreground">{gateway.label}</h2>
            {gateway.is_enabled ? <Badge tone="success">On</Badge> : <Badge tone="neutral">Off</Badge>}
            <Badge tone={gateway.mode === "live" ? "brand" : "info"}>{gateway.mode === "live" ? "Live" : "Test"} mode</Badge>
            {gateway.verified_at ? (
              <Badge tone="success">
                <CircleCheck className="size-3" /> Connected {formatDate(gateway.verified_at)}
              </Badge>
            ) : gateway.configured[gateway.mode] ? (
              <Badge tone="warning">Not tested</Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted">{gateway.description}</p>
        </div>
        <SwitchField
          name={`${gateway.code}-enabled`}
          label={enabled ? "Accepting payments" : "Switched off"}
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
          className="w-full sm:w-auto"
        />
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        {errors.is_enabled && (
          <Alert tone="danger" icon={AlertTriangle}>
            {errors.is_enabled[0]}
          </Alert>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="radiogroup" aria-label={`${gateway.label} mode`} className="inline-grid grid-cols-2 gap-1 rounded-xl bg-surface-muted p-1">
            {(["test", "live"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={mode === option}
                onClick={() => setMode(option)}
                className={cn(
                  "flex h-9 items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-semibold transition-colors",
                  mode === option ? "bg-surface text-foreground shadow-card" : "text-muted hover:text-foreground",
                )}
              >
                {option === "test" ? "Test mode" : "Live mode"}
                {gateway.configured[option] && <Check className="size-3.5 text-success" aria-label="keys saved" />}
              </button>
            ))}
          </div>
          <a href={gateway.dashboard_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline">
            Get your keys from {gateway.label} <ExternalLink className="size-3.5" />
          </a>
        </div>

        {mode === "live" && (
          <Alert tone="warning" icon={AlertTriangle}>
            Live mode charges real cards and accounts. Test thoroughly in test mode first.
          </Alert>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          {fields.map((field) => {
            const error = errors[`credentials.${mode}.${field.name}`];
            const placeholder = field.value
              ? field.secret
                ? `${field.value}  (saved, leave blank to keep)`
                : field.value
              : field.prefix
                ? `${field.prefix}…`
                : "";
            return (
              <TextField
                key={`${mode}-${field.name}`}
                label={`${field.label}${field.required ? "" : " (optional)"}`}
                name={`${gateway.code}-${mode}-${field.name}`}
                type={field.secret ? "password" : "text"}
                autoComplete="off"
                spellCheck={false}
                inputClassName="font-mono"
                value={values[field.name] ?? ""}
                onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
                placeholder={placeholder}
                error={error}
                hint={field.help ?? (field.value && !field.secret ? "Type a new value to replace it." : undefined)}
              />
            );
          })}
        </div>

        <div>
          <p className="text-sm font-medium text-foreground">Webhook URL</p>
          <p className="mt-0.5 text-[13px] text-muted">Add this in your {gateway.label} dashboard so payments are confirmed even if a customer closes their browser.</p>
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-surface-muted py-1.5 pl-3.5 pr-1.5">
            <code className="min-w-0 flex-1 truncate font-mono text-sm text-foreground">{gateway.webhook_url}</code>
            <Button variant="outline" size="sm" onClick={copyWebhook}>
              {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-muted/50 px-5 py-4 sm:px-6">
        <p className="text-xs text-muted">Secret keys are encrypted and never shown again in full.</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={test} disabled={testing || dirty || !gateway.configured[gateway.mode]} title={dirty ? "Save your changes first" : undefined}>
            {testing ? <DotLoader /> : <><PlugZap className="size-4" /> Test connection</>}
          </Button>
          <Button size="sm" onClick={save} disabled={saving || !dirty}>
            {saving ? <DotLoader className="text-current" /> : "Save"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
