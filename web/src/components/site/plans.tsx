"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { bookingUrl, memberships, virtualAddressPlans } from "@/content/site";

/** Where memberships are bought on this site (signed-in customers, from their dashboard). */
const MEMBERSHIP_PAGE = "/dashboard/workspace#plans";
import { cn, formatNaira } from "@/lib/utils";

type Plan = { name: string; price: number; featured?: boolean; features: string[]; note: string };

/** `signUp` is where each plan is bought: both plan types are sold on the booking site for now. */
type PlanTab = { key: "membership" | "virtual-address"; label: string; title: string; intro: string; plans: Plan[]; badge: string; signUp: string };

const tabs: PlanTab[] = [
  {
    key: "membership",
    label: "Membership",
    title: "Work here often? Pay less.",
    signUp: `${bookingUrl}/register?redirect=%2Fmembership`,
    intro: "Subscribe and get a member code that takes money off every booking at checkout.",
    badge: "Best value",
    plans: memberships.map((plan) => ({ ...plan, note: `${plan.discount}% off all bookings` })),
  },
  {
    key: "virtual-address",
    label: "Virtual address",
    title: "A proper address for your business",
    signUp: `${bookingUrl}/#virtual-address`,
    intro: "A professional home for your business, without paying for an office.",
    badge: "Most popular",
    plans: virtualAddressPlans.map((plan) => ({ ...plan, note: `Best for ${plan.bestFor[0]!.toLowerCase()}${plan.bestFor.slice(1)}` })),
  },
];

/**
 * Membership and virtual address plans, switched with a tab like on book.reenite.com.
 * `only` shows a single plan type without the switch (the homepage shows the virtual address).
 */
export function Plans({ only, bookingOnThisSite = false }: { only?: PlanTab["key"]; bookingOnThisSite?: boolean }) {
  const shown = only ? tabs.filter((item) => item.key === only) : tabs;
  const [active, setActive] = useState(0);
  const tab = shown[active]!;

  return (
    <section id={only ?? "plans"} className="scroll-mt-20 bg-surface-muted">
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div data-reveal="" className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold leading-[1.15] text-foreground sm:text-[2.6rem]">{tab.title}</h2>
          <p className="mt-4 text-lg leading-relaxed text-muted">{tab.intro}</p>
        </div>

        {shown.length > 1 && (
          <div role="tablist" aria-label="Plan type" className="mx-auto mt-8 flex w-fit rounded-md border border-border bg-surface p-1">
            {shown.map((item, index) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={index === active}
                onClick={() => setActive(index)}
                className={cn(
                  "rounded-md px-5 py-2 text-sm font-semibold transition-colors",
                  index === active ? "bg-navy-900 text-white dark:bg-navy-700" : "text-muted hover:text-foreground",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        <div role={shown.length > 1 ? "tabpanel" : undefined} data-stagger="" className="mx-auto mt-10 grid max-w-5xl gap-5 md:grid-cols-3">
          {tab.plans.map((plan) => (
            <div
              key={plan.name}
              className={
                plan.featured
                  ? "relative flex flex-col rounded-md bg-navy-950 p-7 text-white"
                  : "flex flex-col rounded-md border border-border bg-surface p-7 text-foreground"
              }
            >
              {plan.featured && <span className="absolute right-5 top-5 rounded-md bg-brand-500 px-2 py-1 text-xs font-bold text-white">{tab.badge}</span>}
              <h3 className="text-lg font-bold">{plan.name}</h3>
              <p className="mt-4">
                <span className="font-display text-4xl font-bold">{formatNaira(plan.price)}</span>
                <span className={plan.featured ? "text-navy-200" : "text-muted"}>/month</span>
              </p>
              <p className={cn("mt-1 font-semibold", plan.featured ? "text-brand-400" : "text-brand-600")}>{plan.note}</p>
              <ul className={cn("mt-6 flex-1 space-y-3 border-t pt-6 text-[15px]", plan.featured ? "border-white/10" : "border-border")}>
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-brand-500" strokeWidth={2.5} /> {feature}
                  </li>
                ))}
              </ul>
              <a href={tab.key === "membership" && bookingOnThisSite ? MEMBERSHIP_PAGE : tab.signUp} className={buttonClasses({ variant: plan.featured ? "primary" : "outline", className: "mt-8 w-full" })}>
                Get {plan.name}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
