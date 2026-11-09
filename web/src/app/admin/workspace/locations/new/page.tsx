import type { Metadata } from "next";
import { Suspense } from "react";
import { LocationForm } from "@/components/admin/workspace/location-form";
import { Skeleton } from "@/components/ui/loader";
import { requireStaff } from "@/lib/session";

export const metadata: Metadata = { title: "New location" };

export default function NewLocationPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[640px] rounded-2xl" />}>
      <Form />
    </Suspense>
  );
}

async function Form() {
  await requireStaff("workspace.manage");
  return <LocationForm />;
}
