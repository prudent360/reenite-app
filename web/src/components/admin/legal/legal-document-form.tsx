"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, FileUp, Search, UserRound, Users, UsersRound, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SwitchField, TextField, TextareaField } from "@/components/ui/form";
import { DotLoader } from "@/components/ui/loader";
import { searchCustomers, updateLegalDocument, uploadLegalDocument } from "@/lib/actions/legal";
import type { CustomerOption, LegalAudience, LegalDocumentDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

const audiences = [
  { value: "selected" as const, icon: UserRound, title: "Chosen clients", body: "Only the clients you pick below." },
  { value: "members" as const, icon: UsersRound, title: "Active members", body: "Everyone with an active membership, including new members later." },
  { value: "all" as const, icon: Users, title: "All clients", body: "Every client account, including people who sign up later." },
];

/**
 * Uploading a document (no `document`) or editing who signs it. Clients newly asked to sign are
 * emailed a link either way.
 */
export function LegalDocumentForm({ document, onDone }: { document?: LegalDocumentDetail; onDone?: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState(document?.title ?? "");
  const [description, setDescription] = useState(document?.description ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [audience, setAudience] = useState<LegalAudience>(document?.audience ?? "selected");
  const [chosen, setChosen] = useState<CustomerOption[]>(
    document ? document.recipients.filter((person) => document.selected_user_ids.includes(person.id)).map(({ id, name, email }) => ({ id, name, email })) : [],
  );
  const [active, setActive] = useState(document?.is_active ?? true);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, startSaving] = useTransition();

  function submit() {
    setErrors({});
    startSaving(async () => {
      const userIds = chosen.map((person) => person.id);
      let result;
      if (document) {
        result = await updateLegalDocument(document.id, { title, description, audience, user_ids: userIds, is_active: active });
      } else {
        const form = new FormData();
        form.set("title", title);
        form.set("description", description);
        form.set("audience", audience);
        if (file) form.set("file", file);
        userIds.forEach((id) => form.append("user_ids[]", String(id)));
        result = await uploadLegalDocument(form);
      }
      if (!result.ok) {
        setErrors(result.errors ?? {});
        if (result.message) toast.error(result.message);
        return;
      }
      toast.success(result.message);
      if (document) onDone?.();
      else router.push(`/admin/legal/${result.data!.id}`);
    });
  }

  return (
    <div className="space-y-5">
      <TextField label="Title" name="title" value={title} onChange={(event) => setTitle(event.target.value)} error={errors.title} placeholder="Virtual Office Agreement" />
      <TextareaField
        label="Note for clients (optional)"
        name="description"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        error={errors.description}
        hint="Shown above the document, e.g. what it covers."
        className="[&_textarea]:min-h-20"
      />

      {!document && (
        <div className="space-y-1.5">
          <span className="text-sm font-medium text-foreground">Document (PDF)</span>
          <label
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed p-4 transition-colors hover:border-navy-200",
              errors.file ? "border-danger" : "border-border",
            )}
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-foreground">
              <FileUp className="size-5" />
            </span>
            <span className="min-w-0 flex-1 text-sm">
              <span className="block truncate font-semibold text-foreground">{file ? file.name : "Choose a PDF"}</span>
              <span className="text-muted">{file ? `${(file.size / 1024 / 1024).toFixed(1)}MB` : "Up to 10MB. Clients read it in the browser before signing."}</span>
            </span>
            <input type="file" accept="application/pdf" className="sr-only" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </label>
          {errors.file && <p className="text-[13px] text-danger">{errors.file[0]}</p>}
        </div>
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-foreground">Who signs it</legend>
        <div role="radiogroup" className="grid gap-2 sm:grid-cols-3">
          {audiences.map((choice) => (
            <button
              key={choice.value}
              type="button"
              role="radio"
              aria-checked={audience === choice.value}
              onClick={() => setAudience(choice.value)}
              className={cn(
                "flex gap-3 rounded-xl border p-3 text-left transition",
                audience === choice.value ? "border-brand-500 bg-brand-50/50 ring-2 ring-brand-500/20" : "border-border hover:border-navy-200",
              )}
            >
              <choice.icon className={cn("mt-0.5 size-4 shrink-0", audience === choice.value ? "text-brand-500" : "text-muted")} />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">{choice.title}</span>
                <span className="block text-xs text-muted">{choice.body}</span>
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      {audience === "selected" && <CustomerPicker chosen={chosen} onChange={setChosen} error={errors.user_ids?.[0]} />}

      {document && (
        <SwitchField
          label="Open for signing"
          description="Switched off, clients aren't asked to sign it any more. Signed copies stay available to everyone who signed."
          checked={active}
          onChange={(event) => setActive(event.target.checked)}
        />
      )}

      <div className="flex flex-wrap gap-3">
        <Button onClick={submit} disabled={saving}>
          {saving ? <DotLoader className="text-current" label="Saving" /> : document ? "Save changes" : "Upload and send"}
        </Button>
        {document && onDone && (
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

/** Search clients by name or email and add them to the list. */
function CustomerPicker({ chosen, onChange, error }: { chosen: CustomerOption[]; onChange: (people: CustomerOption[]) => void; error?: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerOption[]>([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function search(value: string) {
    setQuery(value);
    clearTimeout(timer.current);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(async () => {
      setResults(await searchCustomers(value.trim()));
      setSearching(false);
    }, 250);
  }

  function toggle(person: CustomerOption) {
    onChange(chosen.some((item) => item.id === person.id) ? chosen.filter((item) => item.id !== person.id) : [...chosen, person]);
  }

  return (
    <div className="space-y-2">
      <label className="relative block">
        <span className="sr-only">Search clients</span>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-navy-400" />
        <input
          value={query}
          onChange={(event) => search(event.target.value)}
          placeholder="Search clients by name or email"
          aria-invalid={error ? true : undefined}
          className="h-11 w-full rounded-xl border border-border bg-surface pl-10 pr-3 text-[15px] text-foreground focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15 aria-invalid:border-danger"
        />
        {searching && <DotLoader className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-300" label="Searching" />}
      </label>
      {error && <p className="text-[13px] text-danger">{error}</p>}

      {query.trim().length >= 2 && !searching && (
        <ul className="max-h-60 divide-y divide-border overflow-y-auto rounded-xl border border-border">
          {results.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted">No clients match &ldquo;{query}&rdquo;.</li>
          ) : (
            results.map((person) => {
              const picked = chosen.some((item) => item.id === person.id);
              return (
                <li key={person.id}>
                  <button type="button" onClick={() => toggle(person)} aria-pressed={picked} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-muted">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{person.name}</span>
                      <span className="block truncate text-xs text-muted">{person.email}</span>
                    </span>
                    {picked ? <Check className="size-4 text-brand-500" /> : <span className="text-xs font-semibold text-brand-600">Add</span>}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}

      {chosen.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Chosen clients">
          {chosen.map((person) => (
            <li key={person.id} className="inline-flex max-w-full items-center gap-1 rounded-full bg-navy-50 py-1 pl-3 pr-1 text-sm text-foreground">
              <span className="truncate">{person.name}</span>
              <button type="button" onClick={() => toggle(person)} aria-label={`Remove ${person.name}`} className="rounded-full p-1 text-muted hover:bg-navy-100 hover:text-foreground">
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
