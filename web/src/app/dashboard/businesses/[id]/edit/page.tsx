import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { BusinessForm } from "@/components/businesses/business-form";
import { DeleteBusiness } from "@/components/businesses/delete-business";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { ApiError, api } from "@/lib/api";
import { requireCustomer } from "@/lib/session";
import type { Business } from "@/lib/types";

export const metadata: Metadata = { title: "Edit business" };

export default function EditBusinessPage({ params }: PageProps<"/dashboard/businesses/[id]/edit">) {
  return (
    <div className="max-w-3xl">
      <Suspense fallback={<Skeleton className="h-[560px] rounded-2xl" />}>
        {params.then(({ id }) => (
          <EditBusiness id={id} />
        ))}
      </Suspense>
    </div>
  );
}

async function EditBusiness({ id }: { id: string }) {
  await requireCustomer();
  let business: Business;
  try {
    ({ data: business } = await api<{ data: Business }>(`/businesses/${encodeURIComponent(id)}`));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  return (
    <>
      <PageHeader title={`Edit ${business.name}`} description="Changing the type or taxes updates the deadlines on its calendar." actions={<DeleteBusiness id={business.id} name={business.name} />} />
      <Card>
        <BusinessForm business={business} />
      </Card>
    </>
  );
}
