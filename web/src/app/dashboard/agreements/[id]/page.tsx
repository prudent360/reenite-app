import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, CircleCheck, Download, ExternalLink, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { SignAgreementForm } from "@/components/legal/sign-agreement-form";
import { Alert, Card, CardHeader } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/loader";
import { ApiError, api } from "@/lib/api";
import { requireCustomer } from "@/lib/session";
import type { Agreement } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Agreement" };

export default function AgreementPage({ params }: PageProps<"/dashboard/agreements/[id]">) {
  return (
    <>
      <Link href="/dashboard/agreements" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Agreements
      </Link>
      <Suspense fallback={<Skeleton className="h-[640px] rounded-2xl" />}>
        {params.then(({ id }) => (
          <Detail id={id} />
        ))}
      </Suspense>
    </>
  );
}

async function Detail({ id }: { id: string }) {
  const user = await requireCustomer();
  let agreement: Agreement;
  try {
    ({ data: agreement } = await api<{ data: Agreement }>(`/agreements/${encodeURIComponent(id)}`));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const fileUrl = `/files/agreements/${agreement.id}`;

  return (
    <>
      <PageHeader title={agreement.title} description={`From Reenite · sent ${formatDate(agreement.created_at)}`} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
        <Card className="overflow-hidden">
          <CardHeader
            title="Read the document"
            action={
              <a href={fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
                Open full screen <ExternalLink className="size-3.5" />
              </a>
            }
          />
          {agreement.description && <p className="border-b border-border px-5 py-3 text-sm text-muted sm:px-6">{agreement.description}</p>}
          {/* Phones often can't show PDFs inline, so the link above opens it in their viewer. */}
          <iframe src={`${fileUrl}#view=FitH&navpanes=0`} title={agreement.title} className="h-[70vh] min-h-[480px] w-full bg-surface-muted" />
        </Card>

        <div className="space-y-4 lg:sticky lg:top-24">
          {agreement.signatory && (
            <Alert tone="success" icon={ShieldCheck} title="Already signed by Reenite">
              {agreement.signatory.name}
              {agreement.signatory.title ? `, ${agreement.signatory.title}` : ""}
            </Alert>
          )}

          {agreement.signed_at ? (
            <Card className="p-5 sm:p-6">
              <p className="flex items-center gap-2 font-semibold text-success">
                <CircleCheck className="size-5" /> You signed this
              </p>
              <p className="mt-1 text-sm text-muted">
                As {agreement.signer_name}, on {formatDateTime(agreement.signed_at)}.
              </p>
              <a href={`${fileUrl}/signed`} className={buttonClasses({ className: "mt-4 w-full" })}>
                <Download className="size-4" /> Download signed copy
              </a>
            </Card>
          ) : agreement.is_open ? (
            <SignAgreementForm agreementId={agreement.id} name={user.name} />
          ) : (
            <Alert tone="warning" title="No longer open for signing">
              Reenite has closed this document. Message us if you still need to sign it.
            </Alert>
          )}
        </div>
      </div>
    </>
  );
}
