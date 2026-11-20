"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { CircleAlert, Download, FileSpreadsheet, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { DotLoader } from "@/components/ui/loader";
import { importCustomers, type CustomerImportState } from "@/lib/actions/admin";
import type { CustomerImportResult } from "@/lib/types";
import { cn } from "@/lib/utils";

const SAMPLE = "Name,Email,Phone\nAda Bassey,ada@example.com,08011112222\nEmeka Okon,emeka@example.com,\n";
const MAX_BYTES = 3 * 1024 * 1024;

const results: Record<CustomerImportResult, { label: string; tone: "success" | "info" | "neutral" | "danger" }> = {
  new: { label: "New account", tone: "success" },
  guest: { label: "Guest to account", tone: "info" },
  exists: { label: "Already has one", tone: "neutral" },
  invalid: { label: "Can't import", tone: "danger" },
};

/** A temporary password that is easy to read out or type: two words of letters and four digits. */
function suggestPassword(): string {
  const words = ["Reenite", "Welcome", "Hello", "Office", "Desk", "Start"];
  const digits = String(Math.floor(1000 + Math.random() * 9000));
  return `${words[Math.floor(Math.random() * words.length)]}${digits}`;
}

/** The button on the Customers page, which opens the import dialog. */
export function ImportCustomersButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Upload className="size-4" /> Import customers
      </Button>
      {open && <ImportCustomersDialog onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * Two steps: check the CSV (nothing is saved), then import it with a temporary password.
 * Customers pick their own password the first time they sign in.
 */
function ImportCustomersDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CustomerImportState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState(suggestPassword);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [sendEmail, setSendEmail] = useState(true);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const close = () => dialog.current?.close();
  const summary = preview?.summary;
  const toImport = summary ? summary.new + summary.guest : 0;

  function choose(chosen: File | null) {
    setPreview(null);
    setError(null);
    if (chosen && chosen.size > MAX_BYTES) {
      setFile(null);
      setError("That file is over 3MB. Split it into smaller files and import them one at a time.");
      return;
    }
    setFile(chosen);
  }

  function check() {
    if (!file) return;
    startTransition(async () => {
      const result = await importCustomers(file, { preview: true });
      if (result.ok) setPreview(result);
      else setError(result.errors?.file?.[0] ?? result.message ?? "We couldn't read that file.");
    });
  }

  function runImport() {
    if (!file) return;
    setPasswordError(null);
    startTransition(async () => {
      const result = await importCustomers(file, { preview: false, temporaryPassword: password, sendEmail });
      if (result.ok) {
        toast.success(result.message);
        close();
      } else if (result.errors?.temporary_password) {
        setPasswordError(result.errors.temporary_password[0]);
      } else {
        toast.error(result.errors?.file?.[0] ?? result.message ?? "The import didn't work.");
      }
    });
  }

  const field = "h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15";

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(event) => event.target === dialog.current && !pending && close()}
      className="m-auto w-[calc(100%-2rem)] max-w-3xl rounded-2xl border border-border bg-surface p-0 text-foreground shadow-pop backdrop:bg-navy-950/50"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-bold">Import customers</h2>
          <p className="mt-0.5 text-sm text-muted">Add customers from a spreadsheet. They choose their own password when they first sign in.</p>
        </div>
        <button type="button" onClick={close} className="rounded-lg p-1.5 text-muted hover:bg-surface-muted" aria-label="Close">
          <X className="size-4" />
        </button>
      </div>

      <div className="max-h-[70dvh] space-y-5 overflow-y-auto px-5 py-5">
        <section className="space-y-3">
          <div className="text-sm text-muted">
            <p>
              Save your list as a <strong className="text-foreground">CSV file</strong> (in Excel or Google Sheets: File, Save as or Download, CSV). The first row must be headings.
              We look for <strong className="text-foreground">Name</strong> (or First name and Surname), <strong className="text-foreground">Email</strong> and <strong className="text-foreground">Phone</strong>. Other columns are ignored.
            </p>
            <a
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE)}`}
              download="reenite-customers-sample.csv"
              className="mt-2 inline-flex items-center gap-1.5 font-semibold text-brand-600 hover:underline"
            >
              <Download className="size-3.5" /> Download a sample file
            </a>
          </div>

          <div className={cn("flex items-center gap-3 rounded-xl border border-dashed p-4", file ? "border-brand-500" : "border-border")}>
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
              <FileSpreadsheet className="size-8 shrink-0 text-muted" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{file ? file.name : "Choose a CSV file"}</span>
                <span className="block text-xs text-muted">{file ? `${Math.ceil(file.size / 1024)} KB · click to change` : "Up to 2,000 customers, 3MB"}</span>
              </span>
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => choose(event.target.files?.[0] ?? null)} />
            </label>
            {!preview && (
              <Button size="sm" onClick={check} disabled={!file || pending}>
                {pending ? <DotLoader className="text-current" label="Checking" /> : "Check file"}
              </Button>
            )}
          </div>
          {error && (
            <p className="flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
              <CircleAlert className="mt-0.5 size-4 shrink-0" /> {error}
            </p>
          )}
        </section>

        {summary && preview?.rows && (
          <>
            <section className="space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Tile label="New accounts" value={summary.new} />
                <Tile label="Guests to accounts" value={summary.guest} />
                <Tile label="Already have one" value={summary.exists} muted />
                <Tile label="Can't import" value={summary.invalid} muted />
              </div>
              <div className="max-h-72 overflow-auto rounded-xl border border-border">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="sticky top-0 bg-surface-muted text-xs font-semibold uppercase tracking-wider text-muted">
                    <tr>
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Customer</th>
                      <th className="px-3 py-2">Phone</th>
                      <th className="px-3 py-2">What happens</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {preview.rows.map((row) => (
                      <tr key={row.row} className="align-top">
                        <td className="px-3 py-2 text-muted">{row.row}</td>
                        <td className="px-3 py-2">
                          <span className="block font-medium">{row.name || "—"}</span>
                          <span className="block text-muted">{row.email || "No email"}</span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-muted">{row.phone || "—"}</td>
                        <td className="px-3 py-2">
                          <Badge tone={results[row.result].tone}>{results[row.result].label}</Badge>
                          {row.note && <span className="mt-1 block text-xs text-muted">{row.note}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {toImport > 0 ? (
              <section className="space-y-3">
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold">Temporary password</span>
                  <span className="flex gap-2">
                    <input value={password} onChange={(event) => setPassword(event.target.value)} maxLength={72} className={cn(field, "font-mono")} autoComplete="off" spellCheck={false} />
                    <Button variant="outline" onClick={() => setPassword(suggestPassword())} className="h-10 shrink-0">
                      New one
                    </Button>
                  </span>
                  {passwordError ? (
                    <span className="block text-sm text-danger">{passwordError}</span>
                  ) : (
                    <span className="block text-xs text-muted">Everyone in this file gets this password. It only works until they sign in and choose their own. At least 8 characters, with letters and numbers.</span>
                  )}
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3">
                  <input type="checkbox" checked={sendEmail} onChange={(event) => setSendEmail(event.target.checked)} className="mt-0.5 size-4 accent-brand-500" />
                  <span>
                    <span className="block text-sm font-semibold">Email each customer their sign-in details</span>
                    <span className="block text-[13px] text-muted">
                      Their email address and the temporary password, with a sign-in button. You can change the wording in Settings, Email templates (&ldquo;Imported customer: sign-in details&rdquo;).
                    </span>
                  </span>
                </label>
              </section>
            ) : (
              <p className="rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning">There&apos;s no one new to import in this file.</p>
            )}
          </>
        )}
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-4">
        <Button variant="ghost" onClick={close} disabled={pending}>
          Cancel
        </Button>
        {preview && toImport > 0 && (
          <Button onClick={runImport} disabled={pending || password.trim().length < 8}>
            {pending ? <DotLoader className="text-current" label="Importing" /> : `Import ${toImport} ${toImport === 1 ? "customer" : "customers"}`}
          </Button>
        )}
      </div>
    </dialog>
  );
}

function Tile({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="rounded-xl bg-surface-muted px-3 py-2.5">
      <p className={cn("font-display text-2xl font-extrabold", muted && value > 0 ? "text-muted" : "text-foreground")}>{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
