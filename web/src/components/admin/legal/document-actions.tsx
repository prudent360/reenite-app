"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DotLoader } from "@/components/ui/loader";
import { deleteLegalDocument } from "@/lib/actions/legal";
import type { LegalDocumentDetail } from "@/lib/types";
import { LegalDocumentForm } from "./legal-document-form";

/** Edit who signs a document, switch it off, or delete it while nobody has signed. */
export function DocumentActions({ document }: { document: LegalDocumentDetail }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, startDeleting] = useTransition();

  function remove() {
    if (!window.confirm(`Delete "${document.title}"? Clients will no longer see it.`)) return;
    startDeleting(async () => {
      const result = await deleteLegalDocument(document.id);
      if (!result.ok) {
        toast.error(result.message ?? "Couldn't delete the document.");
        return;
      }
      toast.success(result.message);
      router.push("/admin/legal");
    });
  }

  if (editing) {
    return (
      <Card>
        <CardHeader title="Edit document" description="People newly asked to sign are emailed a link. The PDF itself can't change once it's out, so upload a new document for a new version." />
        <div className="p-5 sm:p-6">
          <LegalDocumentForm key={JSON.stringify(document)} document={document} onDone={() => setEditing(false)} />
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => setEditing(true)}>
        <Pencil className="size-4" /> Edit
      </Button>
      {document.signatures_count === 0 && (
        <Button variant="ghost" onClick={remove} disabled={deleting} className="text-danger">
          {deleting ? <DotLoader className="text-current" label="Deleting" /> : <><Trash2 className="size-4" /> Delete</>}
        </Button>
      )}
    </div>
  );
}
