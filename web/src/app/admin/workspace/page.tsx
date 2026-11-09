import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Clock, MapPin, Phone, Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import type { Location } from "@/lib/types";
import { summariseHours } from "@/lib/workspace";

export const metadata: Metadata = { title: "Locations" };

export default function LocationsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-80 rounded-2xl" />}>
      <Locations />
    </Suspense>
  );
}

async function Locations() {
  await requireStaff("workspace.manage");
  const { data: locations } = await api<{ data: Location[] }>("/admin/workspace/locations");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Hidden locations don&apos;t appear on the website or in booking.</p>
        <ButtonLink href="/admin/workspace/locations/new" size="sm">
          <Plus className="size-4" /> New location
        </ButtonLink>
      </div>
      {locations.length === 0 ? (
        <Card>
          <EmptyState icon={MapPin} title="No locations yet" description="Add Reenite Uyo first, then its spaces." action={<ButtonLink href="/admin/workspace/locations/new">New location</ButtonLink>} />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {locations.map((location) => (
            <Link key={location.id} href={`/admin/workspace/locations/${location.id}`} className="group rounded-2xl border border-border bg-surface p-5 shadow-card transition hover:border-brand-500/50">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold text-foreground group-hover:text-brand-600">{location.name}</p>
                  <p className="flex items-center gap-1.5 text-sm text-muted">
                    <MapPin className="size-4 shrink-0" /> <span className="truncate">{location.address}, {location.city}</span>
                  </p>
                </div>
                {location.is_active ? <Badge tone="success">Open for booking</Badge> : <Badge tone="neutral">Hidden</Badge>}
              </div>
              <div className="mt-4 grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-2">
                <div className="flex gap-2 text-muted">
                  <Clock className="mt-0.5 size-4 shrink-0" />
                  <ul>{summariseHours(location.hours).map((line) => <li key={line}>{line}</li>)}</ul>
                </div>
                <div className="space-y-1 text-muted">
                  <p className="font-semibold text-foreground">{location.spaces_count ?? 0} space{location.spaces_count === 1 ? "" : "s"}</p>
                  {location.phone && <p className="flex items-center gap-1.5"><Phone className="size-4" /> {location.phone}</p>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
