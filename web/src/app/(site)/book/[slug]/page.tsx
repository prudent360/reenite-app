import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { BookWizard } from "@/components/booking/book-wizard";
import { Skeleton } from "@/components/ui/loader";
import { ApiError, api } from "@/lib/api";
import { getBookingSettings, getWorkspaceCatalogue } from "@/lib/booking";
import { bookingPreset, type BookingPreset } from "@/lib/booking-format";
import { getOptionalUser } from "@/lib/session";
import type { Space } from "@/lib/types";

export const metadata: Metadata = { title: "Book a space" };

/** A link to one space opens the booking at the Time step with that space chosen. */
export default async function BookSpacePage({ params, searchParams }: PageProps<"/book/[slug]">) {
  const settings = await getBookingSettings();
  if (settings.destination === "external") {
    redirect(settings.external_url);
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-foreground">Book a space</h1>
      <p className="mt-1 text-muted">Three quick steps, then pay online and you&apos;re confirmed.</p>
      <div className="mt-8">
        <Suspense fallback={<Skeleton className="h-[520px] rounded-2xl" />}>
          {Promise.all([params, searchParams]).then(([{ slug }, query]) => (
            <Wizard slug={slug} preset={bookingPreset(query)} />
          ))}
        </Suspense>
      </div>
    </section>
  );
}

async function Wizard({ slug, preset }: { slug: string; preset: BookingPreset }) {
  if ((await getOptionalUser())?.type === "customer") {
    // Signed-in customers book inside their dashboard, with the same date and time.
    const query = new URLSearchParams(
      Object.entries({ date: preset.date, start: preset.start_time, unit: preset.rate_unit, qty: preset.quantity?.toString() }).filter((entry): entry is [string, string] => Boolean(entry[1])),
    ).toString();
    redirect(`/dashboard/workspace/book/${encodeURIComponent(slug)}${query ? `?${query}` : ""}`);
  }
  let space: Space;
  try {
    ({ data: space } = await api<{ data: Space }>(`/workspace/spaces/${encodeURIComponent(slug)}`, { anonymous: true }));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const catalogue = await getWorkspaceCatalogue();
  const locations = (catalogue?.locations ?? []).filter((location) => (location.spaces ?? []).length > 0);

  // Signed-in customers were sent to the dashboard above, so this is a guest (or staff) booking.
  return <BookWizard locations={locations} user={null} initialSpace={space} preset={preset} />;
}
