"use client";

import { useTransition } from "react";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { voidInvoice } from "@/lib/actions/finance";
import { Button } from "@/components/ui/button";
import { DotLoader } from "@/components/ui/loader";

export function VoidInvoiceButton({ invoiceId, number }: { invoiceId: number; number: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-danger hover:bg-danger-soft"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`Cancel ${number}? The customer will no longer be able to pay it.`)) return;
        startTransition(async () => {
          const result = await voidInvoice(invoiceId);
          if (result.ok) toast.success(result.message);
          else toast.error(result.message ?? "Couldn't cancel this invoice.");
        });
      }}
    >
      {pending ? <DotLoader className="text-danger" /> : <><Ban className="size-4" /> Cancel invoice</>}
    </Button>
  );
}
