"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/form";
import { DotLoader } from "@/components/ui/loader";
import { applyForAddress } from "@/lib/actions/mailbox";
import type { AddressPlan } from "@/lib/types";
import { cn, formatNaira } from "@/lib/utils";

/**
 * Pick a plan, say whose name goes on the address, then pay. The address and the proof-of-address
 * letter are issued as soon as the payment goes through.
 */
export function ApplyForm({ plans, suggestions }: { plans: AddressPlan[]; suggestions: string[] }) {
  const router = useRouter();
  const [planId, setPlanId] = useState(plans[0]?.id ?? 0);
  const [name, setName] = useState(suggestions[0] ?? "");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();
  const plan = plans.find((item) => item.id === planId);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await applyForAddress(planId, name.trim());
      if (result.ok && result.invoiceId) {
        router.push(`/dashboard/billing/invoices/${result.invoiceId}`);
        return;
      }
      setErrors(result.errors ?? {});
      toast.error(result.errors?.membership_plan_id?.[0] ?? result.message ?? "We couldn't start your application. Please try again.");
    });
  };

  return (
    <form onSubmit={submit} className="space-y-8">
      <fieldset>
        <legend className="text-sm font-semibold text-foreground">1. Choose your address</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {plans.map((item) => {
            const selected = item.id === planId;
            return (
              <label
                key={item.id}
                className={cn(
                  "relative flex cursor-pointer flex-col rounded-2xl border bg-surface p-5 transition",
                  selected ? "border-brand-500 ring-2 ring-brand-500/20" : "border-border hover:border-navy-200",
                )}
              >
                <input type="radio" name="plan" value={item.id} checked={selected} onChange={() => setPlanId(item.id)} className="sr-only" />
                <span className="flex items-start justify-between gap-3">
                  <span className="font-semibold text-foreground">{item.name}</span>
                  <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border", selected ? "border-brand-500 bg-brand-500 text-white" : "border-border")}>
                    {selected && <Check className="size-3" strokeWidth={3} />}
                  </span>
                </span>
                <span className="mt-2 flex items-start gap-2 text-sm text-muted">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-brand-500" />
                  <span>
                    {item.location.address}, {item.location.city}, {item.location.state}
                  </span>
                </span>
                {item.description && <span className="mt-2 text-sm text-muted">{item.description}</span>}
                <span className="mt-4 text-foreground">
                  <span className="font-display text-xl font-bold">{formatNaira(item.price)}</span>
                  <span className="text-sm text-muted"> per {item.billing_period}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div>
        <p className="text-sm font-semibold text-foreground">2. Whose name goes on the address?</p>
        <TextField
          className="mt-3 max-w-lg"
          label="Business or personal name"
          name="business_name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={errors.business_name}
          hint="Write it exactly as it appears on your registration or ID. This is the name printed on your proof of address."
          list="address-name-suggestions"
          maxLength={150}
          required
        />
        <datalist id="address-name-suggestions">
          {suggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-border pt-6">
        <Button type="submit" size="lg" disabled={pending || !plan || name.trim().length < 2}>
          {pending ? <DotLoader className="text-current" label="Preparing invoice" /> : plan ? `Continue to pay ${formatNaira(plan.price)}` : "Continue"}
        </Button>
        <p className="text-sm text-muted">Your address and proof-of-address letter are ready as soon as you pay.</p>
      </div>
    </form>
  );
}
