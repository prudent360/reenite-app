"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { AlertCircle, Check, Copy, CreditCard, Landmark, Lock, ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";
import { startPayment, submitBankTransfer } from "@/lib/actions/billing";
import type { FormState, Invoice, PaymentOptions } from "@/lib/types";
import { cn, formatNaira } from "@/lib/utils";
import { Alert, Badge, Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DotLoader } from "@/components/ui/loader";
import { SubmitButton, TextField } from "@/components/ui/form";

type Method = string; // gateway code or "bank_transfer"

type PayAction = (gateway: string) => Promise<FormState & { data?: { redirect_url: string } }>;
type TransferAction = (prev: FormState, formData: FormData) => Promise<FormState>;

/**
 * Online payment and bank transfer for an invoice. Bookings pass their own `pay` and `transfer`
 * actions (guests have no billing pages); otherwise the invoice's billing actions are used.
 */
export function PayPanel({
  invoice,
  options,
  title = "Pay this invoice",
  pay,
  transfer,
}: {
  invoice: Invoice;
  options: PaymentOptions;
  title?: string;
  pay?: PayAction;
  transfer?: TransferAction;
}) {
  const methods = [
    ...options.gateways.map((gateway) => ({ key: gateway.code, label: gateway.label, description: gateway.description, test: gateway.mode === "test" })),
    ...(options.bank_transfer.enabled ? [{ key: "bank_transfer", label: "Bank transfer", description: "Pay into our account, then upload your receipt.", test: false }] : []),
  ];
  const [method, setMethod] = useState<Method | null>(methods[0]?.key ?? null);
  const [redirecting, startRedirect] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (methods.length === 0) {
    return (
      <Card className="p-6">
        <Alert tone="info" icon={AlertCircle} title="Online payment isn't available yet">
          Please contact us to arrange payment for {invoice.number}.
        </Alert>
      </Card>
    );
  }

  function payOnline(gateway: string) {
    setError(null);
    startRedirect(async () => {
      const result = pay ? await pay(gateway) : await startPayment(invoice.id, gateway);
      if (result.ok && result.data) {
        // Leave the app for the gateway's secure checkout page.
        window.location.assign(result.data.redirect_url);
        return;
      }
      setError(result.message ?? "We couldn't start the payment. Please try again.");
    });
  }

  return (
    <Card>
      <CardHeader title={title} description={`Amount due: ${formatNaira(invoice.balance)}`} />
      <div className="space-y-4 p-5 sm:p-6">
        <div role="radiogroup" aria-label="Payment method" className="space-y-2">
          {methods.map((option) => (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={method === option.key}
              onClick={() => {
                setMethod(option.key);
                setError(null);
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border p-4 text-left transition",
                method === option.key ? "border-brand-500 bg-brand-50/50 ring-2 ring-brand-500/20" : "border-border hover:border-navy-200",
              )}
            >
              <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", method === option.key ? "bg-brand-500 text-white" : "bg-navy-50 text-foreground")}>
                {option.key === "bank_transfer" ? <Landmark className="size-5" /> : <CreditCard className="size-5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-semibold text-foreground">
                  {option.label} {option.test && <Badge tone="warning">Test mode</Badge>}
                </span>
                <span className="block text-sm text-muted">{option.description}</span>
              </span>
              <span className={cn("flex size-5 items-center justify-center rounded-full border-2", method === option.key ? "border-brand-500 bg-brand-500 text-white" : "border-navy-200")}>
                {method === option.key && <Check className="size-3" strokeWidth={3} />}
              </span>
            </button>
          ))}
        </div>

        {error && (
          <Alert tone="danger" icon={AlertCircle}>
            {error}
          </Alert>
        )}

        {method && method !== "bank_transfer" && (
          <>
            <Button size="lg" className="w-full" onClick={() => payOnline(method)} disabled={redirecting}>
              {redirecting ? <DotLoader className="text-current" label="Opening secure checkout" /> : <><Lock className="size-4" /> Pay {formatNaira(invoice.balance)}</>}
            </Button>
            <p className="flex items-center justify-center gap-1.5 text-xs text-muted">
              <ShieldCheck className="size-3.5 text-success" /> You&apos;ll pay on {methods.find((item) => item.key === method)?.label}&apos;s secure page. We never see your card details.
            </p>
          </>
        )}

        {method === "bank_transfer" && <BankTransferForm invoice={invoice} options={options} transfer={transfer} />}
      </div>
    </Card>
  );
}

function BankTransferForm({ invoice, options, transfer }: { invoice: Invoice; options: PaymentOptions; transfer?: TransferAction }) {
  const [state, action] = useActionState<FormState, FormData>(transfer ?? submitBankTransfer.bind(null, invoice.id), {});
  const [copied, setCopied] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (state.ok) toast.success(state.message);
    else if (state.message) toast.error(state.message);
  }, [state]);

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Couldn't copy. Please copy it manually.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-xl bg-surface-muted p-4">
        <p className="text-sm font-semibold text-foreground">Transfer exactly {formatNaira(invoice.balance)} to:</p>
        {options.bank_transfer.accounts.map((account) => (
          <div key={account.account_number} className="flex items-center justify-between gap-3 rounded-lg bg-surface p-3">
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-foreground">{account.bank_name}</p>
              <p className="font-mono text-lg tracking-wider text-foreground">{account.account_number}</p>
              <p className="text-muted">{account.account_name}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => copy(account.account_number)} aria-label={`Copy account number ${account.account_number}`}>
              {copied === account.account_number ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
            </Button>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border p-3 text-sm">
          <span className="text-muted">
            Use reference: <span className="font-mono font-semibold text-foreground">{invoice.number}</span>
          </span>
          <Button variant="ghost" size="sm" onClick={() => copy(invoice.number)} aria-label="Copy invoice number">
            {copied === invoice.number ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
          </Button>
        </div>
        {options.bank_transfer.instructions && <p className="whitespace-pre-line text-sm text-muted">{options.bank_transfer.instructions}</p>}
      </div>

      <form action={action} className="space-y-4" noValidate>
        {state.message && !state.ok && (
          <Alert tone="danger" icon={AlertCircle}>
            {state.message}
          </Alert>
        )}
        <div className="space-y-1.5">
          <label htmlFor="proof" className="text-sm font-medium text-foreground">
            Proof of payment
          </label>
          <label
            htmlFor="proof"
            className={cn(
              "flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center text-sm transition hover:border-brand-500",
              state.errors?.proof ? "border-danger" : "border-border",
            )}
          >
            <Upload className="size-5 text-brand-500" />
            <span className="font-medium text-foreground">Choose a screenshot, photo or PDF</span>
            <span className="text-xs text-muted">JPG, PNG, WebP or PDF, up to 5MB</span>
            <input id="proof" name="proof" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required className="mt-2 max-w-full text-xs text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-navy-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-foreground" />
          </label>
          {state.errors?.proof && <p className="text-[13px] text-danger">{state.errors.proof[0]}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Name on the sending account" name="sender_name" required defaultValue={state.values?.sender_name} error={state.errors?.sender_name} />
          <TextField label="Date of transfer" name="transferred_on" type="date" max={today} required defaultValue={state.values?.transferred_on ?? today} error={state.errors?.transferred_on} />
        </div>
        <SubmitButton size="lg" className="w-full">
          I&apos;ve made the transfer
        </SubmitButton>
      </form>
    </div>
  );
}
