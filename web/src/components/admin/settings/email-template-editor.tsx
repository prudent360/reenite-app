"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AlertTriangle, Mail, RotateCcw, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { previewEmailTemplate, resetEmailTemplate, saveEmailTemplate, sendTemplateTest } from "@/lib/actions/settings";
import type { EmailTemplate } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Alert, Badge, Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DotLoader, Skeleton } from "@/components/ui/loader";
import { SwitchField, TextField, TextareaField } from "@/components/ui/form";

type Draft = Pick<EmailTemplate, "subject" | "heading" | "body" | "button_text" | "footer" | "is_enabled">;
type TextKey = "subject" | "heading" | "body" | "button_text" | "footer";

const draftFrom = (template: EmailTemplate): Draft => ({
  subject: template.subject,
  heading: template.heading,
  body: template.body,
  button_text: template.button_text,
  footer: template.footer,
  is_enabled: template.is_enabled,
});

export function EmailTemplatesManager({ templates }: { templates: EmailTemplate[] }) {
  const [selectedKey, setSelectedKey] = useState(templates[0]?.key);
  const [query, setQuery] = useState("");
  const selected = templates.find((template) => template.key === selectedKey) ?? templates[0];
  const term = query.trim().toLowerCase();
  const matches = templates.filter((template) => !term || `${template.name} ${template.description} ${template.group}`.toLowerCase().includes(term));
  // The API lists templates in group order, so grouping keeps that order.
  const groups = matches.reduce((map, template) => map.set(template.group, [...(map.get(template.group) ?? []), template]), new Map<string, EmailTemplate[]>());

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)] xl:items-start">
      <Card className="overflow-hidden xl:sticky xl:top-24">
        <div className="border-b border-border p-3">
          <label className="relative block">
            <span className="sr-only">Search templates</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${templates.length} emails`}
              className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-foreground placeholder:text-muted focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
            />
          </label>
        </div>
        <div className="max-h-[70vh] overflow-y-auto">
          {matches.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted">No emails match.</p>}
          {[...groups].map(([group, items]) => (
            <section key={group} aria-label={group}>
              <h3 className="sticky top-0 z-10 flex items-center justify-between bg-surface-muted px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
                {group}
                <span>{items.length}</span>
              </h3>
              <ul className="divide-y divide-border">
                {items.map((template) => (
                  <li key={template.key}>
                    <button
                      type="button"
                      onClick={() => setSelectedKey(template.key)}
                      aria-current={template.key === selected?.key ? "true" : undefined}
                      className={cn("flex w-full gap-3 px-4 py-3 text-left transition-colors", template.key === selected?.key ? "bg-brand-50/60" : "hover:bg-surface-muted")}
                    >
                      <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg", template.key === selected?.key ? "bg-brand-500 text-white" : "bg-navy-50 text-foreground")}>
                        <Mail className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-foreground">
                          {template.name}
                          {!template.is_enabled && <Badge tone="neutral">Off</Badge>}
                          {template.is_customised && <Badge tone="info">Edited</Badge>}
                        </span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-muted">{template.description}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Card>

      {selected && <TemplateEditor key={`${selected.key}-${selected.updated_at}`} template={selected} />}
    </div>
  );
}

function TemplateEditor({ template }: { template: EmailTemplate }) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(template));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [resetting, startResetting] = useTransition();
  const [testing, startTesting] = useTransition();
  const lastFocused = useRef<{ field: TextKey; element: HTMLInputElement | HTMLTextAreaElement } | null>(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify(draftFrom(template));

  // Re-render the real email (server side) shortly after typing stops.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await previewEmailTemplate(template.key, draft);
      if (cancelled) return;
      if (result.ok && result.data) {
        setPreview(result.data);
        setPreviewError(null);
      } else {
        setPreviewError(Object.values(result.errors ?? {})[0]?.[0] ?? result.message ?? "Preview unavailable.");
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [draft, template.key]);

  const update = (field: keyof Draft, value: string | boolean | null) => setDraft((current) => ({ ...current, [field]: value }));

  /** Remembers where the cursor was so placeholders go there. Input names match the draft fields. */
  const rememberFocus = (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    lastFocused.current = { field: event.currentTarget.name as TextKey, element: event.currentTarget };
  };

  /** Inserts {{placeholder}} at the cursor of the last field the admin was typing in (body by default). */
  function insert(name: string) {
    const token = `{{${name}}}`;
    const target = lastFocused.current;
    const field: TextKey = target?.field ?? "body";
    const current = draft[field] ?? "";
    const start = target?.element.selectionStart ?? current.length;
    const end = target?.element.selectionEnd ?? current.length;
    update(field, current.slice(0, start) + token + current.slice(end));
    requestAnimationFrame(() => {
      target?.element.focus();
      target?.element.setSelectionRange(start + token.length, start + token.length);
    });
  }

  function save() {
    startSaving(async () => {
      const result = await saveEmailTemplate(template.key, draft);
      setErrors(result.errors ?? {});
      if (result.ok) toast.success(result.message);
      else toast.error(result.message ?? "Please check the highlighted fields.");
    });
  }

  function reset() {
    if (!window.confirm(`Reset "${template.name}" to the original wording? Your edits will be lost.`)) return;
    startResetting(async () => {
      const result = await resetEmailTemplate(template.key);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message ?? "Couldn't reset.");
    });
  }

  function test() {
    startTesting(async () => {
      const result = await sendTemplateTest(template.key);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message ?? "Couldn't send the test.");
    });
  }

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] 2xl:items-start">
      <Card>
        <CardHeader
          title={template.name}
          description={template.description}
          action={
            <div className="flex items-center gap-3">
              {dirty && !saving && <span className="hidden text-xs font-medium text-warning sm:inline">Unsaved changes</span>}
              <Button size="sm" onClick={save} disabled={!dirty || saving}>
                {saving ? <DotLoader className="text-current" /> : "Save"}
              </Button>
            </div>
          }
        />
        <div className="space-y-5 p-5 sm:p-6">
          <SwitchField
            name="is_enabled"
            label="Send this email"
            description={draft.is_enabled ? undefined : "Off: this email won't be sent to anyone."}
            checked={draft.is_enabled}
            onChange={(event) => update("is_enabled", event.target.checked)}
          />
          {!draft.is_enabled && template.is_essential && (
            <Alert tone="warning" icon={AlertTriangle}>
              People need this email to sign in or set their password. Turning it off will stop them doing that.
            </Alert>
          )}

          <div>
            <p className="text-sm font-medium text-foreground">Placeholders</p>
            <p className="text-[13px] text-muted">Click to insert at your cursor. They&apos;re filled in for each person.</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {template.placeholders.map((placeholder) => (
                <button
                  key={placeholder.name}
                  type="button"
                  title={placeholder.label}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => insert(placeholder.name)}
                  className="rounded-lg border border-border bg-surface-muted px-2 py-1 font-mono text-xs text-foreground transition hover:border-brand-500 hover:text-brand-600"
                >
                  {`{{${placeholder.name}}}`}
                </button>
              ))}
            </div>
          </div>

          <TextField label="Subject" name="subject" value={draft.subject} onChange={(event) => update("subject", event.target.value)} error={errors.subject} onFocus={rememberFocus} />
          <TextField label="Greeting" name="heading" value={draft.heading} onChange={(event) => update("heading", event.target.value)} error={errors.heading} onFocus={rememberFocus} />
          <TextareaField
            label="Message"
            name="body"
            rows={7}
            value={draft.body}
            onChange={(event) => update("body", event.target.value)}
            error={errors.body}
            hint="Leave a blank line between paragraphs."
            onFocus={rememberFocus}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Button text"
              name="button_text"
              value={draft.button_text ?? ""}
              onChange={(event) => update("button_text", event.target.value || null)}
              error={errors.button_text}
              onFocus={rememberFocus}
            />
            <TextField
              label="Closing note (optional)"
              name="footer"
              value={draft.footer ?? ""}
              onChange={(event) => update("footer", event.target.value || null)}
              error={errors.footer}
              onFocus={rememberFocus}
            />
          </div>
        </div>
        <div className="flex flex-wrap justify-between gap-2 border-t border-border bg-surface-muted/50 px-5 py-4 sm:px-6">
          <Button variant="ghost" size="sm" onClick={reset} disabled={resetting || !template.is_customised}>
            {resetting ? <DotLoader /> : <><RotateCcw className="size-4" /> Reset to default</>}
          </Button>
          <Button variant="outline" size="sm" onClick={test} disabled={testing || dirty} title={dirty ? "Save first to test your changes" : undefined}>
            {testing ? <DotLoader /> : <><Send className="size-4" /> Send me a test</>}
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden 2xl:sticky 2xl:top-24">
        <div className="border-b border-border px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Preview</p>
          <p className="mt-1 truncate font-semibold text-foreground">{preview?.subject ?? "…"}</p>
          <p className="text-xs text-muted">Sample values: Aniekan Bassey, links expire in 60 minutes</p>
        </div>
        {previewError && (
          <Alert tone="warning" icon={AlertTriangle} className="m-4">
            {previewError}
          </Alert>
        )}
        {preview ? (
          <iframe title={`Preview of ${template.name}`} srcDoc={preview.html} sandbox="" className="h-[640px] w-full bg-white" />
        ) : (
          <Skeleton className="m-4 h-[600px]" />
        )}
      </Card>
    </div>
  );
}
