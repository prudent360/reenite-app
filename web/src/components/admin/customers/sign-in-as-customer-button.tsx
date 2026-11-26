"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DotLoader } from "@/components/ui/loader";
import { signInAsCustomer } from "@/lib/actions/staff-session";

/** Opens the customer's dashboard as them, e.g. to book a space for a walk-in. */
export function SignInAsCustomerButton({ customerId, name }: { customerId: number; name: string }) {
  const [pending, startTransition] = useTransition();

  function signIn() {
    startTransition(async () => {
      const result = await signInAsCustomer(customerId);
      if (result.ok && result.href) {
        // A full page load, so no admin page stays cached while acting as the customer.
        window.location.assign(result.href);
        return;
      }
      toast.error(result.message ?? `Couldn't sign in as ${name}.`);
    });
  }

  return (
    <Button variant="outline" onClick={signIn} disabled={pending} title={`Use the website as ${name}, e.g. to book for them`}>
      {pending ? <DotLoader className="text-current" label="Signing in" /> : <><LogIn className="size-4" /> Sign in as customer</>}
    </Button>
  );
}
