"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, BadgePercent, CalendarClock, CircleCheck, CreditCard, RefreshCw, Ticket } from "lucide-react";
import { toast } from "sonner";
import { renewPlan, setAutoRenew } from "@/lib/actions/billing";
import type { MyPlans } from "@/lib/types";
import { useNow } from "@/components/booking/booking-tracker";
import { Badge, Card } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { DotLoader } from "@/components/ui/loader";
import { cn, formatDate, formatNaira } from "@/lib/utils";

type Pass = MyPlans["passes"][number];
type Membership = MyPlans["memberships"][number];

/**
 * A pass or membership: how much of the period is gone, what's left to use, and what happens
 * when it ends (renews on the saved card, waits for the customer, or has already been renewed).
 */
export function PlanCard({ plan, kind, card }: { plan: Pass | Membership; kind: "passes" | "memberships"; card: MyPlans["card"] }) {
  const now = useNow();
  const router = useRouter();
  const [toggling, startToggle] = useTransition();
  const [renewing, startRenew] = useTransition();
  const [autoRenew, setAuto] = useState(plan.auto_renew);
  const isPass = kind === "passes";
  const pass = isPass ? (plan as Pass) : null;
  const membership = isPass ? null : (plan as Membership);

  const start = plan.starts_at ? Date.parse(plan.starts_at) : null;
  const end = plan.ends_at ? Date.parse(plan.ends_at) : null;
  const periodPercent = now !== null && start !== null && end !== null ? Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100)) : null;
  const daysLeft = now !== null && end !== null ? Math.max(0, Math.ceil((end - now) / 86_400_000)) : null;
  const ended = plan.status === "expired";
  const renewedAlready = plan.renewal?.status === "active";
  const renewalDue = plan.renewal?.status === "pending" && plan.renewal.invoice_payable;

  function toggle(on: boolean) {
    setAuto(on);
    startToggle(async () => {
      const result = await setAutoRenew(kind, plan.id, on);
      if (result.ok) toast.success(result.message);
      else {
        setAuto(!on);
        toast.error(result.message ?? "We couldn't change that.");
      }
    });
  }

  function renew() {
    startRenew(async () => {
      const result = await renewPlan(kind, plan.id);
      if (result.ok && result.invoiceId) router.push(`/dashboard/billing/invoices/${result.invoiceId}`);
      else toast.error(result.message ?? "We couldn't start the renewal.");
    });
  }

  if (plan.status === "pending") {
    return (
      <Card className="p-5">
        <Header isPass={isPass} name={isPass ? plan.name : `${plan.name} membership`} badge={<Badge tone="warning">Awaiting payment</Badge>} />
        <p className="mt-2 text-sm text-muted">Pay the invoice to start your {isPass ? "pass" : "membership"}.</p>
        {plan.invoice_payable && plan.invoice_id && (
          <ButtonLink href={`/dashboard/billing/invoices/${plan.invoice_id}`} size="sm" className="mt-3">
            Pay now
          </ButtonLink>
        )}
      </Card>
    );
  }

  const creditsUsed = pass ? pass.credits - pass.credits_left : 0;
  const lowOnTime = daysLeft !== null && daysLeft <= 3 && !ended;

  return (
    <Card className="flex flex-col p-5">
      <Header
        isPass={isPass}
        name={isPass ? plan.name : `${plan.name} membership`}
        badge={ended ? <Badge>Ended</Badge> : lowOnTime && !renewedAlready ? <Badge tone="warning">Ends soon</Badge> : <Badge tone="success">Active</Badge>}
      />

      {membership && !ended && <p className="mt-2 text-sm text-muted">{membership.discount_percent}% off every booking.</p>}

      {pass && !ended && (
        <div className="mt-4">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-semibold text-foreground">
              {pass.credits_left} {pass.credit_type} left
            </span>
            <span className="text-muted">
              {creditsUsed} of {pass.credits} used
            </span>
          </div>
          <div className="mt-1.5 flex gap-1" aria-hidden>
            {Array.from({ length: Math.min(pass.credits, 30) }, (_, index) => (
              <span key={index} className={cn("h-2 flex-1 rounded-full", index < creditsUsed ? "bg-navy-200 dark:bg-navy-700" : "bg-brand-500")} />
            ))}
          </div>
        </div>
      )}

      {!ended && periodPercent !== null && (
        <div className="mt-4">
          <div className="flex items-baseline justify-between text-xs text-muted">
            <span>{formatDate(plan.starts_at)}</span>
            <span className={cn("font-semibold", lowOnTime ? "text-warning" : "text-foreground")}>{daysLeft === 0 ? "Ends today" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}</span>
            <span>{formatDate(plan.ends_at)}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-valuenow={Math.round(periodPercent)} aria-valuemin={0} aria-valuemax={100} aria-label="Period used">
            <div className={cn("h-full rounded-full", lowOnTime ? "bg-warning" : "bg-navy-900 dark:bg-white/70")} style={{ width: `${periodPercent}%` }} />
          </div>
        </div>
      )}

      {/* What happens next */}
      <div className="mt-5 space-y-3 border-t border-border pt-4">
        {plan.renewal_failure && !renewedAlready && (
          <p className="flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-sm text-foreground">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
            <span>Automatic renewal didn&apos;t go through: {plan.renewal_failure}</span>
          </p>
        )}

        {renewedAlready ? (
          <p className="flex items-center gap-2 text-sm text-foreground">
            <CircleCheck className="size-4 text-success" /> Renewed. The next period starts {formatDate(plan.renewal?.starts_at ?? plan.ends_at)}.
          </p>
        ) : renewalDue && plan.renewal?.invoice_id ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-foreground">Your next period is ready to pay{plan.renewal_price ? ` (${formatNaira(plan.renewal_price)})` : ""}.</p>
            <ButtonLink href={`/dashboard/billing/invoices/${plan.renewal.invoice_id}`} size="sm">
              Pay to renew
            </ButtonLink>
          </div>
        ) : plan.renewal_mode === "unavailable" ? (
          <p className="text-sm text-muted">We don&apos;t offer this plan any more, so it won&apos;t renew. Choose another below when it ends.</p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm text-foreground">
              {plan.renewal_mode === "card" && autoRenew ? (
                <>
                  <RefreshCw className="size-4 text-success" /> Renews {formatDate(plan.ends_at)} on your {card?.label}
                </>
              ) : (
                <>
                  <CalendarClock className="size-4 text-muted" /> {ended ? `Ended ${formatDate(plan.ends_at)}` : `Ends ${formatDate(plan.ends_at)}`}
                </>
              )}
            </p>
            <Button size="sm" variant={(ended || lowOnTime) && !(plan.renewal_mode === "card" && autoRenew) ? "primary" : "outline"} onClick={renew} disabled={renewing}>
              {renewing ? <DotLoader className="text-current" label="Opening invoice" /> : ended ? `Renew${plan.renewal_price ? ` for ${formatNaira(plan.renewal_price)}` : ""}` : "Renew now"}
            </Button>
          </div>
        )}

        {!renewedAlready && plan.renewal_mode !== "unavailable" && !ended && (
          <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl bg-surface-muted/70 px-3 py-2.5">
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">Renew automatically</span>
              <span className="block text-xs text-muted">
                {card
                  ? `We charge your ${card.label} the day before it ends and email you 3 days before.`
                  : 'Tick "Save this card" when you next pay by card, and renewals happen on their own.'}
              </span>
            </span>
            <span className="relative mt-0.5 inline-flex shrink-0">
              <input type="checkbox" role="switch" className="peer sr-only" checked={autoRenew} disabled={toggling} onChange={(event) => toggle(event.target.checked)} />
              <span className="h-6 w-11 rounded-full bg-navy-100 transition-colors peer-checked:bg-brand-500 peer-focus-visible:ring-4 peer-focus-visible:ring-brand-500/25 peer-disabled:opacity-60" />
              <span className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
            </span>
          </label>
        )}
        {!card && autoRenew && !renewedAlready && (
          <p className="flex items-center gap-1.5 text-xs text-warning">
            <CreditCard className="size-3.5" /> No card saved yet, so we&apos;ll email you a pay link instead.
          </p>
        )}
      </div>
    </Card>
  );
}

function Header({ isPass, name, badge }: { isPass: boolean; name: string; badge: React.ReactNode }) {
  const Icon = isPass ? Ticket : BadgePercent;
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="flex min-w-0 items-center gap-2 font-semibold text-foreground">
        <Icon className="size-5 shrink-0 text-brand-500" /> <span className="truncate">{name}</span>
      </p>
      {badge}
    </div>
  );
}
