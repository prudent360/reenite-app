import type { Metadata } from "next";
import { Suspense } from "react";
import { AddonManager } from "@/components/admin/workspace/managers";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import type { Addon, Space } from "@/lib/types";

export const metadata: Metadata = { title: "Add-ons" };

export default function AddonsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <Addons />
    </Suspense>
  );
}

async function Addons() {
  await requireStaff("workspace.manage");
  const [{ data: addons }, { data: spaces }] = await Promise.all([api<{ data: Addon[] }>("/admin/workspace/addons"), api<{ data: Space[] }>("/admin/workspace/spaces")]);
  return <AddonManager addons={addons} spaces={spaces} />;
}
