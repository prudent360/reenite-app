import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { SeatManager } from "@/components/admin/workspace/seat-manager";
import { SpaceForm } from "@/components/admin/workspace/space-form";
import { Skeleton } from "@/components/ui/loader";
import { ApiError, api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import type { Space, SpaceSeat } from "@/lib/types";
import { spaceFormOptions } from "@/lib/workspace-options";

export default function EditSpacePage({ params }: PageProps<"/admin/workspace/spaces/[id]">) {
  return (
    <>
      <Link href="/admin/workspace/spaces" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Spaces
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
  let space: Space;
  let options: Awaited<ReturnType<typeof spaceFormOptions>>;
  try {
    [{ data: space }, options] = await Promise.all([api<{ data: Space }>(`/admin/workspace/spaces/${encodeURIComponent(id)}`), spaceFormOptions()]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  // Shared spaces (hot desks) can have named seats that customers choose from.
  const seats = space.type?.booking_mode === "shared" ? (await api<{ data: SpaceSeat[] }>(`/admin/workspace/spaces/${space.id}/seats`)).data : null;

  return (
    <>
      <title>{`${space.name} | Reenite Admin`}</title>
      <SpaceForm key={space.id} space={space} options={options} />
      {seats && (
        <div className="mt-6">
          <SeatManager space={space} seats={seats} />
        </div>
      )}
    </>
  );
}
