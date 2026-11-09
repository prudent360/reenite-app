import type { Metadata } from "next";
import { Suspense } from "react";
import { MapPin } from "lucide-react";
import { SpaceForm } from "@/components/admin/workspace/space-form";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { requireStaff } from "@/lib/session";
import { spaceFormOptions } from "@/lib/workspace-options";

export const metadata: Metadata = { title: "New space" };

export default function NewSpacePage({ searchParams }: PageProps<"/admin/workspace/spaces/new">) {
  return (
    <Suspense fallback={<Skeleton className="h-[640px] rounded-2xl" />}>
      {searchParams.then((params) => (
        <Form locationId={Number(params.location) || undefined} />
      ))}
    </Suspense>
  );
}

async function Form({ locationId }: { locationId?: number }) {
  await requireStaff("workspace.manage");
  const options = await spaceFormOptions();
  if (options.locations.length === 0) {
    return (
      <Card>
        <EmptyState icon={MapPin} title="Add a location first" description="Every space belongs to a location." action={<ButtonLink href="/admin/workspace/locations/new">New location</ButtonLink>} />
      </Card>
    );
  }
  return <SpaceForm options={options} defaultLocationId={locationId} />;
}
