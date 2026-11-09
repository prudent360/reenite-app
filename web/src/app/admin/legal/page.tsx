import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, FileSignature, Plus } from "lucide-react";
import { audienceLabels } from "@/components/admin/legal/audience";
import { PageHeader } from "@/components/app/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import type { LegalDocument } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Legal documents" };

export default function LegalDocumentsPage() {
  return (
    <>
      <PageHeader
        title="Legal documents"
        description="Agreements clients sign online. Each one goes out already signed by Reenite, and clients download their signed copy themselves."
        actions={
          <ButtonLink href="/admin/legal/new">
            <Plus className="size-4" /> Upload document
          </ButtonLink>
        }
      />
      <Suspense fallback={<Skeleton className="h-80 rounded-2xl" />}>
        <Documents />
      </Suspense>
    </>
  );
}

async function Documents() {
  await requireStaff("documents.manage");
  const { data: documents } = await api<{ data: LegalDocument[] }>("/admin/legal-documents");

  if (documents.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={FileSignature}
          title="No documents yet"
          description="Upload a PDF, such as your virtual office agreement, and choose who signs it. They're emailed a link to read and sign."
          action={<ButtonLink href="/admin/legal/new">Upload document</ButtonLink>}
        />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-border">
        {documents.map((document) => {
          const total = document.audience_count ?? 0;
          const signed = document.signatures_count;
          return (
            <li key={document.id}>
              <Link href={`/admin/legal/${document.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-surface-muted/60 sm:px-6">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-foreground">
                  <FileSignature className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold text-foreground">{document.title}</span>
                    {!document.is_active && <Badge>Switched off</Badge>}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">
                    {audienceLabels[document.audience]} · uploaded {formatDate(document.created_at)}
                  </span>
                </span>
                <span className="hidden shrink-0 text-right sm:block">
                  <span className="block font-semibold text-foreground">
                    {signed} of {Math.max(total, signed)} signed
                  </span>
                  <span className="mt-1 block h-1.5 w-32 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
                    <span className="block h-full rounded-full bg-success" style={{ width: `${total ? Math.min(100, (signed / total) * 100) : 0}%` }} />
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-navy-300" />
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
