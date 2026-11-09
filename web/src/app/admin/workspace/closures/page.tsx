import type { Metadata } from "next";
import { Suspense } from "react";
import { ClosureManager } from "@/components/admin/workspace/managers";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import type { Closure, Location, Space } from "@/lib/types";

export const metadata: Metadata = { title: "Closures" };

export default function ClosuresPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <Closures />
    </Suspense>
  );
}

async function Closures() {
  await requireStaff("workspace.manage");
  const [{ data: closures }, { data: locations }, { data: spaces }] = await Promise.all([
    api<{ data: Closure[] }>("/admin/workspace/closures"),
    api<{ data: Location[] }>("/admin/workspace/locations"),
    api<{ data: Space[] }>("/admin/workspace/spaces"),
  ]);
  return <ClosureManager closures={closures} locations={locations} spaces={spaces} />;
}
