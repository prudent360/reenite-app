import type { Metadata } from "next";
import { Suspense } from "react";
import { CategoryManager } from "@/components/admin/catalogue/category-manager";
import { PageHeader } from "@/components/app/page-header";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import type { ServiceCategory } from "@/lib/types";

export const metadata: Metadata = { title: "Service categories" };

export default function CategoriesPage() {
  return (
    <>
      <PageHeader title="Service categories" description="How services are grouped for customers." />
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Categories />
      </Suspense>
    </>
  );
}

async function Categories() {
  await requireStaff("services.manage");
  const { data: categories } = await api<{ data: ServiceCategory[] }>("/admin/service-categories");
  return <CategoryManager categories={categories} />;
}
