import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, CloudOff } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { BookWizard } from "@/components/booking/book-wizard";
import { EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { ApiError, api } from "@/lib/api";
import { getBookingSettings, getWorkspaceCatalogue } from "@/lib/booking";
import { requireCustomer } from "@/lib/session";
import type { Space } from "@/lib/types";

/** Booking steps inside the dashboard, shared by /dashboard/workspace/book and /dashboard/workspace/book/[slug]. */
export function DashboardBooking({ slug }: { slug: Promise<string> | null }) {
  return (
    <>
      <Link href="/dashboard/workspace" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Workspace
      </Link>
      <PageHeader title="Book a space" description="Three quick steps, then pay online and you're confirmed." />
      <Suspense fallback={<Skeleton className="h-[520px] rounded-2xl" />}>
        <Wizard slug={slug} />
      </Suspense>
    </>
  );
}

async function Wizard({ slug }: { slug: Promise<string> | null }) {
  const [user, settings] = await Promise.all([requireCustomer(), getBookingSettings()]);
  if (settings.destination === "external") {
    // Booking on this site is paused; the booking site takes over.
    redirect(settings.external_url);
  }

  let initialSpace: Space | null = null;
  const chosen = slug ? await slug : null;
  if (chosen) {
    try {
      ({ data: initialSpace } = await api<{ data: Space }>(`/workspace/spaces/${encodeURIComponent(chosen)}`, { anonymous: true }));
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 404)) throw error;
    }
  }

  const catalogue = await getWorkspaceCatalogue();
  const locations = (catalogue?.locations ?? []).filter((location) => (location.spaces ?? []).length > 0);
  if (locations.length === 0) {
    return <EmptyState icon={CloudOff} title="Spaces are unavailable right now" description="Please refresh in a moment, or message us to book." className="py-20" />;
  }
  return <BookWizard locations={locations} user={user} initialSpace={initialSpace} inDashboard />;
}
