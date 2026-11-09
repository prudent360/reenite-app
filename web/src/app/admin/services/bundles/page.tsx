import type { Metadata } from "next";
import { Suspense } from "react";
import { BundleManager } from "@/components/admin/catalogue/bundle-manager";
import { PageHeader } from "@/components/app/page-header";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import type { Bundle, Service } from "@/lib/types";

export const metadata: Metadata = { title: "Bundles" };

export default function BundlesPage() {
  return (
    <>
      <PageHeader title="Bundles" description="Sell several services together as one package." />
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Bundles />
      </Suspense>
    </>
  );
}

async function Bundles() {
  await requireStaff("services.manage");
  const [{ data: bundles }, { data: services }] = await Promise.all([
    api<{ data: Bundle[] }>("/admin/bundles"),
    api<{ data: Service[] }>("/admin/services"),
  ]);
  return <BundleManager bundles={bundles} services={services} />;
}
