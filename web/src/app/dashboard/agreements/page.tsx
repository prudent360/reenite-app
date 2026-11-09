import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, CircleCheck, Download, FileSignature, PenLine } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { buttonClasses } from "@/components/ui/button";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireCustomer } from "@/lib/session";
import type { Agreement } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Agreements" };

export default function AgreementsPage() {
  return (
    <>
      <PageHeader title="Agreements" description="Documents to sign with Reenite. Read, sign online, and download your signed copy any time." />
      <Suspense fallback={<Skeleton className="h-80 rounded-2xl" />}>
        <Agreements />
      </Suspense>
    </>
  );
}

async function Agreements() {
  await requireCustomer();
  const { data: agreements } = await api<{ data: Agreement[] }>("/agreements");
  const toSign = agreements.filter((agreement) => !agreement.signed_at);
  const signed = agreements.filter((agreement) => agreement.signed_at);

  if (agreements.length === 0) {
    return (
      <Card>
        <EmptyState icon={FileSignature} title="Nothing to sign" description="When Reenite sends you an agreement, such as your virtual office agreement, it appears here and we email you." />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {toSign.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader title="Waiting for your signature" description="Reenite has already signed these." />
          <ul className="divide-y divide-border">
            {toSign.map((agreement) => (
              <li key={agreement.id}>
                <Link href={`/dashboard/agreements/${agreement.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-surface-muted/60 sm:px-6">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <PenLine className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-foreground">{agreement.title}</span>
                    <span className="block text-sm text-muted">Sent {formatDate(agreement.created_at)}</span>
                  </span>
                  <span className="hidden text-sm font-semibold text-brand-600 sm:inline">Read and sign</span>
                  <ChevronRight className="size-4 shrink-0 text-navy-300" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {signed.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader title="Signed" description="Your copies, signed by you and Reenite." />
          <ul className="divide-y divide-border">
            {signed.map((agreement) => (
              <li key={agreement.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 sm:px-6">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-success-soft text-success">
                  <CircleCheck className="size-5" />
                </span>
                <Link href={`/dashboard/agreements/${agreement.id}`} className="min-w-0 flex-1 hover:underline">
                  <span className="block truncate font-semibold text-foreground">{agreement.title}</span>
                  <span className="block text-sm text-muted">Signed {formatDate(agreement.signed_at)}</span>
                </Link>
                {!agreement.is_open && <Badge>Closed</Badge>}
                <a href={`/files/agreements/${agreement.id}/signed`} className={buttonClasses({ variant: "outline", size: "sm" })}>
                  <Download className="size-4" /> Download
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
