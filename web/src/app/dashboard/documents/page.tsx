import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Download, FileText, FolderLock, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { FileStatus } from "@/components/orders/order-parts";
import { buttonClasses } from "@/components/ui/button";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireCustomer } from "@/lib/session";
import type { VaultFile } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Documents" };

export default function DocumentsPage() {
  return (
    <>
      <PageHeader title="Documents" description="Your certificates and the documents you've shared with us, stored privately." />
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Vault />
      </Suspense>
    </>
  );
}

function sizeLabel(bytes: number) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

async function Vault() {
  await requireCustomer();
  const { data: files } = await api<{ data: VaultFile[] }>("/documents");
  const fromReenite = files.filter((file) => file.kind === "deliverable");
  const yours = files.filter((file) => file.kind !== "deliverable");

  if (files.length === 0) {
    return (
      <Card>
        <EmptyState icon={FolderLock} title="Your vault is empty" description="Documents you upload for orders and certificates we deliver, like your CAC certificate and TIN, will be stored here." className="py-20" />
      </Card>
    );
  }

  const row = (file: VaultFile) => (
    <li key={file.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
      <span className={`flex size-10 items-center justify-center rounded-xl ${file.kind === "deliverable" ? "bg-success-soft text-success" : "bg-navy-50 text-foreground"}`}>
        <FileText className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-foreground">{file.kind === "deliverable" ? file.name : file.label}</p>
        <p className="text-xs text-muted">
          <Link href={`/dashboard/orders/${file.order_reference}`} className="hover:text-brand-600">{file.service_name} · {file.order_reference}</Link> · {formatDate(file.created_at)} · {sizeLabel(file.size)}
        </p>
      </div>
      {file.kind !== "deliverable" ? <FileStatus file={file} /> : <Badge tone="success">From Reenite</Badge>}
      <a href={`/files/orders/${file.order_reference}/${file.id}`} target="_blank" rel="noreferrer" className={buttonClasses({ variant: "outline", size: "sm" })}>
        <Download className="size-4" /> Open
      </a>
    </li>
  );

  return (
    <div className="space-y-6">
      <p className="flex items-center gap-2 text-sm text-muted">
        <ShieldCheck className="size-4 text-success" /> Only you and the officer handling your order can open these files.
      </p>
      {fromReenite.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader title="From Reenite" description="Certificates and documents we've prepared for you." />
          <ul className="divide-y divide-border">{fromReenite.map(row)}</ul>
        </Card>
      )}
      {yours.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader title="Uploaded by you" />
          <ul className="divide-y divide-border">{yours.map(row)}</ul>
        </Card>
      )}
    </div>
  );
}
