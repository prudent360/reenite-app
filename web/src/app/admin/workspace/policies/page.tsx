import type { Metadata } from "next";
import { Suspense } from "react";
import { PolicyManager } from "@/components/admin/workspace/managers";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import type { CancellationPolicy } from "@/lib/types";

export const metadata: Metadata = { title: "Cancellation policies" };

export default function PoliciesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <Policies />
    </Suspense>
  );
}

async function Policies() {
  await requireStaff("workspace.manage");
  const { data } = await api<{ data: CancellationPolicy[] }>("/admin/workspace/cancellation-policies");
  return <PolicyManager policies={data} />;
}
