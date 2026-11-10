import type { Metadata } from "next";
import { Suspense } from "react";
import { MembershipManager, PassPlanManager } from "@/components/admin/workspace/managers";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import type { Location, MembershipPlan, PassPlan, SpaceType } from "@/lib/types";

export const metadata: Metadata = { title: "Passes & memberships" };

export default function PlansPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <Plans />
    </Suspense>
  );
}

async function Plans() {
  await requireStaff("workspace.manage");
  const [{ data: passes }, { data: memberships }, { data: types }, { data: locations }] = await Promise.all([
    api<{ data: PassPlan[] }>("/admin/workspace/pass-plans"),
    api<{ data: MembershipPlan[] }>("/admin/workspace/membership-plans"),
    api<{ data: SpaceType[] }>("/admin/workspace/space-types"),
    api<{ data: Location[] }>("/admin/workspace/locations"),
  ]);
  return (
    <div className="space-y-8">
      <PassPlanManager plans={passes} types={types} locations={locations} />
      <MembershipManager plans={memberships} locations={locations} />
    </div>
  );
}
