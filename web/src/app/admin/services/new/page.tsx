import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, FolderTree } from "lucide-react";
import { ServiceDetailsForm } from "@/components/admin/catalogue/service-details-form";
import { PageHeader } from "@/components/app/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import type { ServiceCategory } from "@/lib/types";

export const metadata: Metadata = { title: "New service" };

export default function NewServicePage() {
  return (
    <>
      <Link href="/admin/services" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Services
      </Link>
      <PageHeader title="New service" description="Start with the basics. You'll set up the intake form, documents and stages next." />
      <Suspense fallback={<Skeleton className="h-[520px] rounded-2xl" />}>
        <NewServiceForm />
      </Suspense>
    </>
  );
}

async function NewServiceForm() {
  await requireStaff("services.manage");
  const { data: categories } = await api<{ data: ServiceCategory[] }>("/admin/service-categories");

  if (categories.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={FolderTree}
          title="Create a category first"
          description="Every service belongs to a category, like Business Registration or Tax & Compliance."
          action={<ButtonLink href="/admin/services/categories">Add a category</ButtonLink>}
        />
      </Card>
    );
  }

  return <ServiceDetailsForm categories={categories} />;
}
