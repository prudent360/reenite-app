"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Info, MailCheck, Send } from "lucide-react";
import { toast } from "sonner";
import { saveMailSettings, sendTestEmail } from "@/lib/actions/settings";
import type { MailSettings } from "@/lib/types";
import { Alert, Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DotLoader } from "@/components/ui/loader";
import { SelectField, SwitchField, TextField } from "@/components/ui/form";

export function MailSettingsForm({ settings, adminEmail }: { settings: MailSettings; adminEmail: string }) {
  const [form, setForm] = useState({
    enabled: settings.enabled,
    provider: settings.provider,
    host: settings.host ?? "",
    port: String(settings.port ?? ""),
    encryption: settings.encryption,
    username: settings.username ?? "",
    password: "",
    from_address: settings.from_address ?? "",
    from_name: settings.from_name ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [testTo, setTestTo] = useState(adminEmail);
  const [testing, startTesting] = useTransition();
  const [lastTest, setLastTest] = useState<{ ok: boolean; message: string } | null>(null);

  const provider = settings.providers.find((item) => item.key === form.provider);
  const update = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));

  function chooseProvider(key: string) {
    const preset = settings.providers.find((item) => item.key === key);
    if (!preset) return;
    update({
      provider: key,
      ...(key !== "custom" && { host: preset.host, port: String(preset.port), encryption: preset.encryption }),
      ...(key === "resend" && !form.username && { username: "resend" }),
    });
  }

  function save() {
    startSaving(async () => {
      const result = await saveMailSettings({ ...form, port: form.port ? Number(form.port) : null, password: form.password || null });
      setErrors(result.errors ?? {});
      setFormError(result.ok ? null : (result.message ?? null));
      if (result.ok) {
        update({ password: "" });
        toast.success(result.message);
      } else {
        toast.error(result.message ?? "Please check the highlighted fields.");
      }
    });
  }

  function test() {
    startTesting(async () => {
      const result = await sendTestEmail(testTo);
      setLastTest({ ok: Boolean(result.ok && result.data?.delivered), message: result.message ?? result.errors?.to?.[0] ?? "Test failed." });
      if (result.ok) toast.success(result.message);
      else toast.error(result.message ?? "Test failed.");
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
      <Card>
        <CardHeader title="Email delivery" description="How Reenite sends verification, password and order emails." />
        <div className="space-y-6 p-5 sm:p-6">
          {settings.server_mailer && (
            <Alert tone="info" icon={Info} title="Not set up here yet">
              The server is currently using its own setting (<code className="font-mono">{settings.server_mailer}</code>). Save this form to manage email from here.
            </Alert>
          )}

          <SwitchField
            name="enabled"
            label="Send emails"
            description={form.enabled ? "Emails are delivered through the server below." : "Off: emails are written to the server log and nobody receives them. Useful while testing."}
            checked={form.enabled}
            onChange={(event) => update({ enabled: event.target.checked })}
          />

          {formError && (
            <Alert tone="danger" icon={AlertTriangle}>
              {formError}
            </Alert>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField label="Email provider" name="provider" value={form.provider} onChange={(event) => chooseProvider(event.target.value)} error={errors.provider}>
              {settings.providers.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </SelectField>
            <TextField label="SMTP host" name="host" value={form.host} onChange={(event) => update({ host: event.target.value })} error={errors.host} placeholder="smtp.example.com" />
            <TextField label="Port" name="port" inputMode="numeric" value={form.port} onChange={(event) => update({ port: event.target.value.replace(/\D/g, "") })} error={errors.port} />
            <SelectField label="Security" name="encryption" value={form.encryption} onChange={(event) => update({ encryption: event.target.value as "tls" | "ssl" })} error={errors.encryption}>
              <option value="ssl">SSL (usually port 465)</option>
              <option value="tls">TLS / STARTTLS (usually port 587)</option>
            </SelectField>
            <TextField
              label="Username"
              name="username"
              autoComplete="off"
              value={form.username}
              onChange={(event) => update({ username: event.target.value })}
              error={errors.username}
              placeholder={provider?.username_hint}
            />
            <TextField
              label={form.provider === "resend" ? "API key" : "Password"}
              name="password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(event) => update({ password: event.target.value })}
              error={errors.password}
              placeholder={settings.password_set ? "•••••••• saved (leave blank to keep)" : ""}
            />
          </div>

          <div className="grid gap-5 border-t border-border pt-6 sm:grid-cols-2">
            <TextField label="Sender name" name="from_name" value={form.from_name} onChange={(event) => update({ from_name: event.target.value })} error={errors.from_name} />
            <TextField
              label="Sender email"
              name="from_address"
              type="email"
              value={form.from_address}
              onChange={(event) => update({ from_address: event.target.value })}
              error={errors.from_address}
              hint="Must be on a domain verified with your provider."
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving ? <DotLoader className="text-current" /> : "Save email settings"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="xl:sticky xl:top-24">
        <CardHeader title="Send a test" description="Uses the saved settings." />
        <div className="space-y-4 p-5">
          <TextField label="Send to" name="test_to" type="email" value={testTo} onChange={(event) => setTestTo(event.target.value)} />
          <Button variant="navy" className="w-full" onClick={test} disabled={testing || !testTo}>
            {testing ? <DotLoader className="text-current" /> : <><Send className="size-4" /> Send test email</>}
          </Button>
          {lastTest && (
            <Alert tone={lastTest.ok ? "success" : "warning"} icon={lastTest.ok ? MailCheck : AlertTriangle}>
              {lastTest.message}
            </Alert>
          )}
        </div>
      </Card>
    </div>
  );
}
