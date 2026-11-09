"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { setCustomerStatus } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { DotLoader } from "@/components/ui/loader";

export function CustomerStatusButton({ userId, name, status }: { userId: number; name: string; status: "active" | "suspended" }) {
  const [pending, startTransition] = useTransition();
  const suspending = status === "active";

  function toggle() {
    if (suspending && !window.confirm(`Suspend ${name}? They will be signed out and unable to sign in.`)) {
      return;
    }
    startTransition(async () => {
      const result = await setCustomerStatus(userId, suspending ? "suspended" : "active");
      if (result.ok) {
        toast.success(result.message);
      } else {
        toast.error(result.message ?? "Couldn't update this customer.");
      }
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      disabled={pending}
      className={suspending ? "text-danger hover:bg-danger-soft" : "text-success hover:bg-success-soft"}
    >
      {pending ? <DotLoader className="text-current" /> : suspending ? "Suspend" : "Reactivate"}
    </Button>
  );
}
