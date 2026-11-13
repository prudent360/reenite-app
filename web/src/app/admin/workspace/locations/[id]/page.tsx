import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { LocationForm } from "@/components/admin/workspace/location-form";
import { SelfCheckInCard } from "@/components/admin/workspace/self-check-in-card";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { ApiError, api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import type { Location } from "@/lib/types";
import { formatNaira } from "@/lib/utils";

export default function EditLocationPage({ params }: PageProps<"/admin/workspace/locations/[id]">) {
  return (
    <>
      <Link href="/admin/workspace" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Locations
      </Link>
      <Suspense fallback={<Skeleton className="h-[640px] rounded-2xl" />}>
        {params.then(({ id }) => (
          <Editor id={id} />
        ))}
      </Suspense>
    </>
  );
}

async function Editor({ id }: { id: string }) {
  await requireStaff("workspace.manage");
  let location: Location;
  try {
    ({ data: location } = await api<{ data: Location }>(`/admin/workspace/locations/${encodeURIComponent(id)}`));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  return (
    <div className="space-y-6">
      <title>{`${location.name} | Reenite Admin`}</title>
      <LocationForm key={location.id} location={location} />
      <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
        <SelfCheckInCard locationId={location.id} />
      </Suspense>
      <Card className="overflow-hidden">
        <CardHeader
          title={`Spaces at ${location.name}`}
          action={
            <ButtonLink href={`/admin/workspace/spaces/new?location=${location.id}`} size="sm" variant="outline">
              <Plus className="size-4" /> Add space
            </ButtonLink>
          }
        />
        <ul className="divide-y divide-border">
          {(location.spaces ?? []).map((space) => {
            const from = space.rates?.filter((rate) => rate.is_active).sort((a, b) => a.price - b.price)[0];
            return (
              <li key={space.id}>
                <Link href={`/admin/workspace/spaces/${space.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3.5 hover:bg-surface-muted/50">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-foreground">{space.name}</span>
                    <span className="text-xs text-muted">{space.type?.name} · up to {space.capacity}</span>
                  </span>
                  {from && <span className="text-sm text-muted">from {formatNaira(from.price)}/{from.unit}</span>}
                  {!space.is_active && <Badge tone="neutral">Hidden</Badge>}
                </Link>
              </li>
            );
          })}
          {(location.spaces?.length ?? 0) === 0 && <li className="px-5 py-6 text-sm text-muted">No spaces here yet.</li>}
        </ul>
      </Card>
    </div>
  );
}
