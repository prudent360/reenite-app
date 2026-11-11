"use client";

import { useState, useTransition } from "react";
import { Info, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { saveWhatsAppSettings, sendWhatsAppTest } from "@/lib/actions/settings";
import type { WhatsAppSettings } from "@/lib/types";
import { Alert, Badge, Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DotLoader } from "@/components/ui/loader";
import { SelectField, SwitchField, TextField } from "@/components/ui/form";

/** Meta WhatsApp Cloud API keys, plus the approved template to send for each event. */
export function WhatsAppSettingsForm({ settings }: { settings: WhatsAppSettings }) {
  const [form, setForm] = useState({
    enabled: settings.enabled,
    phone_number_id: settings.phone_number_id ?? "",
    access_token: "",
    language: settings.language,
    templates: Object.fromEntries(settings.events.map((event) => [event.key, event.template ?? ""])) as Record<string, string>,
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, startSaving] = useTransition();
  const [testTo, setTestTo] = useState("");
  const [testEvent, setTestEvent] = useState("");
  const [testing, startTesting] = useTransition();
  const [lastTest, setLastTest] = useState<{ ok: boolean; message: string } | null>(null);

  function save() {
    startSaving(async () => {
      const result = await saveWhatsAppSettings({
        enabled: form.enabled,
        phone_number_id: form.phone_number_id.trim() || null,
        access_token: form.access_token.trim() || null,
        language: form.language.trim(),
        templates: Object.fromEntries(Object.entries(form.templates).map(([key, value]) => [key, value.trim()])),
      });
      setErrors(result.errors ?? {});
      if (result.ok) {
        setForm((current) => ({ ...current, access_token: "" }));
        toast.success(result.message);
      } else {
        toast.error(result.message ?? "Please check the highlighted fields.");
      }
    });
  }

  function test() {
    startTesting(async () => {
      const result = await sendWhatsAppTest(testTo.trim(), testEvent || null);
      setLastTest({ ok: Boolean(result.ok), message: result.message ?? result.errors?.to?.[0] ?? "The test failed." });
    });
  }

  const groups = [...new Set(settings.events.map((event) => event.group))];

  return (
    <div className="max-w-4xl space-y-6">
      <Alert tone="info" icon={Info} title="How WhatsApp messages work">
        WhatsApp only lets a business message customers first with a <strong>template Meta has approved</strong>. In Meta&apos;s WhatsApp Manager, create a template for each event
        you want, using {"{{1}}"}, {"{{2}}"}... in the order shown below, and wait for approval. Then enter its name here. Customers only get messages if they switch on WhatsApp
        updates in their settings ({settings.opted_in_customers} {settings.opted_in_customers === 1 ? "has" : "have"} so far). Email still goes out as usual.
      </Alert>

      <Card>
        <CardHeader
          title="WhatsApp Cloud API"
          description="From Meta for Developers > your app > WhatsApp > API Setup."
          action={settings.configured ? <Badge tone="success">Connected</Badge> : <Badge>Off</Badge>}
        />
        <div className="space-y-5 p-5 sm:p-6">
          <SwitchField label="Send WhatsApp messages" description="Turn off to stop all WhatsApp messages without losing your settings." checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} />
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Phone number ID"
              name="phone_number_id"
              value={form.phone_number_id}
              onChange={(event) => setForm({ ...form, phone_number_id: event.target.value })}
              error={errors.phone_number_id}
              inputClassName="font-mono"
              hint="A long number Meta shows under your business phone number. It is not the phone number."
            />
            <TextField
              label="Template language"
              name="language"
              value={form.language}
              onChange={(event) => setForm({ ...form, language: event.target.value })}
              error={errors.language}
              inputClassName="font-mono"
              hint="The language your templates were approved in, e.g. en or en_US."
            />
          </div>
          <TextField
            label="Access token"
            name="access_token"
            type="password"
            value={form.access_token}
            onChange={(event) => setForm({ ...form, access_token: event.target.value })}
            error={errors.access_token}
            inputClassName="font-mono"
            autoComplete="off"
            hint={settings.access_token_set ? "Saved. Leave empty to keep it. Use a permanent System User token, not the 24-hour test token." : "Use a permanent System User token from Meta Business Settings."}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Templates for each event" description="Leave an event empty to send it by email only." />
        <div className="divide-y divide-border">
          {groups.map((group) => (
            <div key={group} className="space-y-4 p-5 sm:p-6">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">{group}</p>
              {settings.events
                .filter((event) => event.group === group)
                .map((event) => (
                  <div key={event.key} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_260px] sm:items-start">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{event.name}</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-muted">
                        {event.parameters.map((parameter, index) => (
                          <span key={parameter.key} className="mr-3 inline-block">
                            <span className="font-mono text-foreground">{`{{${index + 1}}}`}</span> {parameter.label}
                          </span>
                        ))}
                      </p>
                    </div>
                    <TextField
                      label={`Template for ${event.name}`}
                      className="[&_label]:sr-only"
                      name={`templates.${event.key}`}
                      value={form.templates[event.key] ?? ""}
                      onChange={(input) => setForm({ ...form, templates: { ...form.templates, [event.key]: input.target.value } })}
                      error={errors[`templates.${event.key}`]}
                      placeholder="template_name"
                      inputClassName="font-mono"
                    />
                  </div>
                ))}
            </div>
          ))}
        </div>
        <div className="flex justify-end border-t border-border p-5 sm:p-6">
          <Button onClick={save} disabled={saving}>
            {saving ? <DotLoader className="text-current" label="Saving" /> : "Save WhatsApp settings"}
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Send a test" description="Uses the saved settings. Save first if you changed anything." />
        <div className="space-y-4 p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <TextField label="WhatsApp number" name="test_to" type="tel" value={testTo} onChange={(event) => setTestTo(event.target.value)} placeholder="0803 123 4567" />
            <SelectField label="Message" name="test_event" value={testEvent} onChange={(event) => setTestEvent(event.target.value)}>
              <option value="">Meta&apos;s hello_world template</option>
              {settings.events
                .filter((event) => event.template)
                .map((event) => (
                  <option key={event.key} value={event.key}>
                    {event.name} ({event.template})
                  </option>
                ))}
            </SelectField>
            <Button variant="outline" onClick={test} disabled={testing || !testTo.trim()}>
              {testing ? <DotLoader className="text-current" label="Sending" /> : <><Send className="size-4" /> Send test</>}
            </Button>
          </div>
          {lastTest && (
            <Alert tone={lastTest.ok ? "success" : "danger"} icon={MessageCircle} title={lastTest.ok ? "Sent" : "Not sent"}>
              {lastTest.message}
            </Alert>
          )}
        </div>
      </Card>
    </div>
  );
}
