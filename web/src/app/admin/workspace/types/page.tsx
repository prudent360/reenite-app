import type { Metadata } from "next";
import { Suspense } from "react";
import { SpaceTypeManager } from "@/components/admin/workspace/managers";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import type { SpaceType } from "@/lib/types";

export const metadata: Metadata = { title: "Space types" };

export default function SpaceTypesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <Types />
    </Suspense>
  );
}

async function Types() {
  await requireStaff("workspace.manage");
  const { data } = await api<{ data: SpaceType[] }>("/admin/workspace/space-types");
  return <SpaceTypeManager types={data} />;
}
