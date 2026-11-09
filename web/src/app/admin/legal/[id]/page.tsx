import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, CircleCheck, Clock, Download, FileText } from "lucide-react";
import { audienceLabels } from "@/components/admin/legal/audience";
import { DocumentActions } from "@/components/admin/legal/document-actions";
import { PageHeader } from "@/components/app/page-header";
import { buttonClasses } from "@/components/ui/button";
import { Badge, Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { ApiError, api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import type { LegalDocumentDetail } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Legal document" };

export default function LegalDocumentPage({ params }: PageProps<"/admin/legal/[id]">) {
  return (
    <>
      <Link href="/admin/legal" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Legal documents
      </Link>
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        {params.then(({ id }) => (
          <Detail id={id} />
        ))}
      </Suspense>
    </>
  );
}

async function Detail({ id }: { id: string }) {
  await requireStaff("documents.manage");
  let document: LegalDocumentDetail;
  try {
    ({ data: document } = await api<{ data: LegalDocumentDetail }>(`/admin/legal-documents/${encodeURIComponent(id)}`));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const waiting = document.recipients.filter((person) => !person.signed_at).length;

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {document.title}
            {!document.is_active && <Badge>Switched off</Badge>}
          </span>
        }
        description={`${audienceLabels[document.audience]} · uploaded ${formatDate(document.created_at)}`}
        actions={
          <a href={`/files/admin/legal/${document.id}`} target="_blank" rel="noreferrer" className={buttonClasses({ variant: "outline" })}>
            <FileText className="size-4" /> View PDF
          </a>
        }
      />

      <div className="space-y-6">
        <DocumentActions document={document} />

        <Card className="overflow-hidden">
          <CardHeader
            title="Who has signed"
            description={`${document.signatures_count} signed${waiting ? ` · ${waiting} waiting` : ""}. Download any signed copy for your records.`}
          />
          {document.recipients.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted sm:px-6">Nobody is asked to sign this yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {document.recipients.map((person) => (
                <li key={person.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 sm:px-6">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">{person.name}</span>
                    <span className="block truncate text-sm text-muted">{person.email}</span>
                  </span>
                  {person.signed_at ? (
                    <>
                      <span className="inline-flex items-center gap-1.5 text-sm text-success">
                        <CircleCheck className="size-4" /> Signed {formatDateTime(person.signed_at)}
                      </span>
                      <a href={`/files/admin/legal/${document.id}/signed/${person.id}`} className={buttonClasses({ variant: "outline", size: "sm" })}>
                        <Download className="size-4" /> Signed copy
                      </a>
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-sm text-muted">
                      <Clock className="size-4" /> Waiting
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
