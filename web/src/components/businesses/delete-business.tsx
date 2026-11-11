"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteBusiness } from "@/lib/actions/businesses";
import { Button } from "@/components/ui/button";
import { DotLoader } from "@/components/ui/loader";

export function DeleteBusiness({ id, name }: { id: number; name: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button variant="ghost" size="sm" className="text-danger" onClick={() => setConfirming(true)}>
        <Trash2 className="size-4" /> Remove business
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-foreground">Remove {name} and its calendar?</span>
      <Button
        variant="danger"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await deleteBusiness(id);
            if (result.ok) {
              toast.success(result.message);
              router.push("/dashboard/businesses");
            } else {
              toast.error(result.message ?? "We couldn't remove it.");
            }
          })
        }
      >
        {pending ? <DotLoader className="text-current" label="Removing" /> : "Yes, remove"}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        Keep it
      </Button>
    </div>
  );
}
