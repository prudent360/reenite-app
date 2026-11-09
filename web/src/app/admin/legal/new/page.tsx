import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { LegalDocumentForm } from "@/components/admin/legal/legal-document-form";
import { PageHeader } from "@/components/app/page-header";
import { Alert, Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { can, requireStaff } from "@/lib/session";
import type { Signatory } from "@/lib/types";

export const metadata: Metadata = { title: "Upload document" };

export default function NewLegalDocumentPage() {
  return (
    <>
      <Link href="/admin/legal" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Legal documents
      </Link>
      <PageHeader title="Upload document" description="Clients read it, sign with their finger or mouse, and download the signed copy." />
      <Suspense fallback={<Skeleton className="h-[560px] rounded-2xl" />}>
        <Upload />
      </Suspense>
    </>
  );
}

async function Upload() {
  const staff = await requireStaff("documents.manage");
  // Only settings managers can read the signatory; for anyone else the API checks on upload.
  const signatory = can(staff, "settings.manage") ? (await api<{ data: Signatory }>("/admin/settings/signatory")).data : null;

  return (
    <Card className="max-w-3xl p-5 sm:p-6">
      {signatory && !signatory.signature && (
        <Alert
          tone="warning"
          icon={AlertCircle}
          title="Add Reenite's signature first"
          className="mb-5"
          action={
            <Link href="/admin/settings/signatory" className="shrink-0 font-semibold underline">
              Set up signatory
            </Link>
          }
        >
          Documents go out already signed by Reenite, so the founder&apos;s name and signature are needed before you upload.
        </Alert>
      )}
      <LegalDocumentForm />
    </Card>
  );
}
