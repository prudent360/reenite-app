import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { InvoiceForm } from "@/components/admin/finance/invoice-form";
import { PageHeader } from "@/components/app/page-header";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import type { Service } from "@/lib/types";

export const metadata: Metadata = { title: "New invoice" };

export default function NewInvoicePage() {
  return (
    <>
      <Link href="/admin/finance/invoices" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Invoices
      </Link>
      <PageHeader title="New invoice" description="Bill a customer for a service or anything else. They can pay online or by bank transfer." />
      <Suspense fallback={<Skeleton className="h-[480px] rounded-2xl" />}>
        <Form />
      </Suspense>
    </>
  );
}

async function Form() {
  await requireStaff("invoices.manage");
  // Catalogue lookups need services.manage; without it the form still works with typed lines.
  const services = await api<{ data: Service[] }>("/admin/services?status=active").then((result) => result.data).catch(() => [] as Service[]);
  return <InvoiceForm services={services} />;
}
