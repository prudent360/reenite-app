import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DoorOpen, Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import type { Space } from "@/lib/types";
import { formatNaira } from "@/lib/utils";
import { rateUnits } from "@/lib/workspace";

export const metadata: Metadata = { title: "Spaces" };

export default function SpacesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <Spaces />
    </Suspense>
  );
}

async function Spaces() {
  await requireStaff("workspace.manage");
  const { data: spaces } = await api<{ data: Space[] }>("/admin/workspace/spaces");
  const byLocation = Map.groupBy(spaces, (space) => space.location?.name ?? "");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Prices for shared spaces like hot desks are per seat.</p>
        <ButtonLink href="/admin/workspace/spaces/new" size="sm">
          <Plus className="size-4" /> New space
        </ButtonLink>
      </div>
      {spaces.length === 0 && (
        <Card>
          <EmptyState icon={DoorOpen} title="No spaces yet" description="Add desks, offices, studios and halls customers can book." action={<ButtonLink href="/admin/workspace/spaces/new">New space</ButtonLink>} />
        </Card>
      )}
      {[...byLocation].map(([location, items]) => (
        <Card key={location} className="overflow-hidden">
          <CardHeader title={location} description={`${items.length} space${items.length === 1 ? "" : "s"}`} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-surface-muted text-xs font-semibold uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-3">Space</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Capacity</th>
                  <th className="px-5 py-3">Prices</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((space) => (
                  <tr key={space.id} className="hover:bg-surface-muted/50">
                    <td className="px-5 py-3.5">
                      <Link href={`/admin/workspace/spaces/${space.id}`} className="font-semibold text-foreground hover:text-brand-600">{space.name}</Link>
                      {space.summary && <p className="max-w-xs truncate text-xs text-muted">{space.summary}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-muted">
                      {space.type?.name}
                      {space.type?.booking_mode === "shared" && <span className="block text-xs">Shared seats</span>}
                    </td>
                    <td className="px-5 py-3.5 text-muted">{space.capacity}</td>
                    <td className="px-5 py-3.5">
                      <ul className="space-y-0.5">
                        {(space.rates ?? []).map((rate) => (
                          <li key={rate.unit} className={rate.is_active ? "text-foreground" : "text-muted line-through"}>
                            {formatNaira(rate.price)} <span className="text-muted">/ {rateUnits.find((u) => u.unit === rate.unit)?.per}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-5 py-3.5">
                      {space.is_active ? <Badge tone="success">Bookable</Badge> : <Badge tone="neutral">Hidden</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}
