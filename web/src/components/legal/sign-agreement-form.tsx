"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextField } from "@/components/ui/form";
import { DotLoader } from "@/components/ui/loader";
import { signAgreement } from "@/lib/actions/legal";
import { SignaturePad } from "./signature-pad";

/** Full name (prefilled from the account), signature and agreement, then sign. */
export function SignAgreementForm({ agreementId, name: accountName }: { agreementId: number; name: string }) {
  const [name, setName] = useState(accountName);
  const [signature, setSignature] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [signing, startSigning] = useTransition();

  function sign() {
    if (!signature) {
      setErrors({ signature: ["Add your signature."] });
      return;
    }
    setErrors({});
    startSigning(async () => {
      const result = await signAgreement(agreementId, { name, signature, agree });
      if (result.ok) toast.success(result.message);
      else {
        setErrors(result.errors ?? {});
        if (result.message) toast.error(result.message);
      }
    });
  }

  return (
    <Card className="space-y-4 p-5 sm:p-6">
      <div>
        <h2 className="text-base font-bold text-foreground">Sign</h2>
        <p className="mt-0.5 text-sm text-muted">Your signature is added to a signing page at the end, next to Reenite&apos;s.</p>
      </div>
      <TextField label="Full name" name="name" value={name} onChange={(event) => setName(event.target.value)} error={errors.name} autoComplete="name" />
      <div>
        <SignaturePad onChange={setSignature} name={name} invalid={Boolean(errors.signature)} />
        {errors.signature && <p className="mt-1.5 text-[13px] text-danger">{errors.signature[0]}</p>}
      </div>
      <label className="flex items-start gap-3 text-sm text-foreground">
        <input type="checkbox" checked={agree} onChange={(event) => setAgree(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-brand-500" />
        <span>I have read this document and agree to its terms. I understand my electronic signature is legally binding.</span>
      </label>
      {errors.agree && <p className="-mt-2 text-[13px] text-danger">{errors.agree[0]}</p>}
      <Button onClick={sign} disabled={signing} className="w-full">
        {signing ? <DotLoader className="text-current" label="Signing" /> : "Sign document"}
      </Button>
    </Card>
  );
}
