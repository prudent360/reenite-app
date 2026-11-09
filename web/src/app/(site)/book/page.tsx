import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CloudOff } from "lucide-react";
import { BookWizard } from "@/components/booking/book-wizard";
import { EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { getBookingSettings, getWorkspaceCatalogue } from "@/lib/booking";
import { getOptionalUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Book a space",
  description: "Book a hot desk, private office, meeting room, podcast studio or event hall at Reenite Uyo. Pay online and you're confirmed straight away.",
};

export default async function BookPage() {
  const settings = await getBookingSettings();
  if (settings.destination === "external") {
    // Booking on this site is paused: send people to the booking site instead.
    redirect(settings.external_url);
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-foreground">Book a space</h1>
      <p className="mt-1 text-muted">Three quick steps, then pay online and you&apos;re confirmed.</p>
      <div className="mt-8">
        {/* Whether someone is signed in is per request, so the form streams in. */}
        <Suspense fallback={<Skeleton className="h-[520px] rounded-2xl" />}>
          <Wizard />
        </Suspense>
      </div>
    </section>
  );
}

async function Wizard() {
  const [catalogue, user] = await Promise.all([getWorkspaceCatalogue(), getOptionalUser()]);
  if (user?.type === "customer") {
    // Signed-in customers book inside their dashboard.
    redirect("/dashboard/workspace/book");
  }
  const locations = (catalogue?.locations ?? []).filter((location) => (location.spaces ?? []).length > 0);
  if (locations.length === 0) {
    return <EmptyState icon={CloudOff} title="Spaces are unavailable right now" description="Please refresh in a moment, or message us on WhatsApp to book." className="py-20" />;
  }
  // Only guests (and staff, who can't book for themselves) get this far, so the form asks for details.
  return <BookWizard locations={locations} user={null} />;
}
