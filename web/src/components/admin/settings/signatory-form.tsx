"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/form";
import { DotLoader } from "@/components/ui/loader";
import { SignaturePad } from "@/components/legal/signature-pad";
import { saveSignatory } from "@/lib/actions/legal";
import type { Signatory } from "@/lib/types";

/** The name, title and signature already on every document clients are asked to sign. */
export function SignatoryForm({ signatory }: { signatory: Signatory }) {
  const [name, setName] = useState(signatory.name ?? "");
  const [title, setTitle] = useState(signatory.title ?? "");
  const [signature, setSignature] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(!signatory.signature);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, startSaving] = useTransition();
  const changed = name !== (signatory.name ?? "") || title !== (signatory.title ?? "") || signature !== null;

  function save() {
    setErrors({});
    startSaving(async () => {
      const result = await saveSignatory({ name, title, signature });
      if (result.ok) toast.success(result.message);
      else {
        setErrors(result.errors ?? {});
        if (result.message) toast.error(result.message);
      }
    });
  }

  return (
    <Card>
      <CardHeader
        title="Reenite's signatory"
        description="Printed on every legal document, so clients receive them already signed by Reenite. Documents already signed keep the details they were signed with."
      />
      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-4">
          <TextField label="Full name" name="name" value={name} onChange={(event) => setName(event.target.value)} error={errors.name} autoComplete="name" />
          <TextField
            label="Title"
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            error={errors.title}
            placeholder="Founder"
            hint="Shown under the name, e.g. Founder or Managing Director."
          />
        </div>

        <div className="space-y-2">
          {replacing ? (
            <>
              <SignaturePad onChange={setSignature} name={name} allowUpload invalid={Boolean(errors.signature)} />
              {errors.signature && <p className="text-[13px] text-danger">{errors.signature[0]}</p>}
              {signatory.signature && (
                <button
                  type="button"
                  onClick={() => {
                    setReplacing(false);
                    setSignature(null);
                  }}
                  className="text-sm font-semibold text-brand-600 hover:underline"
                >
                  Keep the current signature
                </button>
              )}
            </>
          ) : (
            <>
              <span className="text-sm font-medium text-foreground">Signature</span>
              <div className="flex aspect-[3/1] items-center justify-center rounded-xl border border-border bg-white p-4">
                {/* eslint-disable-next-line @next/next/no-img-element -- a data URL from the API */}
                <img src={signatory.signature!} alt={`${signatory.name}'s signature`} className="max-h-full max-w-full" />
              </div>
              <button type="button" onClick={() => setReplacing(true)} className="text-sm font-semibold text-brand-600 hover:underline">
                Replace signature
              </button>
            </>
          )}
        </div>

        <div className="lg:col-span-2">
          <Button onClick={save} disabled={!changed || saving}>
            {saving ? <DotLoader className="text-current" label="Saving" /> : "Save signatory"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
