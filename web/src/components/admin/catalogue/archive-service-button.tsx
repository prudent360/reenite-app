"use client";

import { useTransition } from "react";
import { Archive } from "lucide-react";
import { toast } from "sonner";
import { archiveService } from "@/lib/actions/catalogue";
import { Button } from "@/components/ui/button";
import { DotLoader } from "@/components/ui/loader";

export function ArchiveServiceButton({ serviceId, name }: { serviceId: number; name: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-danger hover:bg-danger-soft"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`Archive "${name}"? Customers won't be able to order it. Existing orders keep their history.`)) {
          return;
        }
        startTransition(async () => {
          const result = await archiveService(serviceId);
          // On success the action redirects, so we only get here on failure.
          if (result && !result.ok) {
            toast.error(result.message ?? "Couldn't archive this service.");
          }
        });
      }}
    >
      {pending ? <DotLoader className="text-danger" /> : <><Archive className="size-4" /> Archive</>}
    </Button>
  );
}
