"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DotLoader } from "@/components/ui/loader";
import { buyPlan } from "@/lib/actions/bookings";

/** Creates the invoice for a pass or membership and opens it to pay. */
export function BuyPlanButton({ kind, planId, label, featured = false }: { kind: "passes" | "memberships"; planId: number; label: string; featured?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant={featured ? "primary" : "outline"}
      className="w-full"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await buyPlan(kind, planId);
          if (result.ok && result.data) router.push(`/dashboard/billing/invoices/${result.data.invoice_id}`);
          else toast.error(result.message ?? "We couldn't start that. Please try again.");
        })
      }
    >
      {pending ? <DotLoader className="text-current" label="Preparing invoice" /> : label}
    </Button>
  );
}
