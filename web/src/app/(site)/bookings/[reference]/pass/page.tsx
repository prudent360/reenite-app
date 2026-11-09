import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingPass } from "@/components/booking/booking-pass";
import { Skeleton } from "@/components/ui/loader";

export const metadata: Metadata = { title: "Booking pass", robots: { index: false } };

/** The pass for guests, opened with the private link from their booking. */
export default function BookingPassPage({ params, searchParams }: PageProps<"/bookings/[reference]/pass">) {
  return (
    <section className="px-4 py-10 sm:px-6">
      <Suspense fallback={<Skeleton className="mx-auto h-[560px] max-w-xl rounded-3xl" />}>
        {Promise.all([params, searchParams]).then(([{ reference }, query]) => {
          const token = typeof query.token === "string" ? query.token : "";
          return <BookingPass reference={reference} token={token} backHref={`/bookings/${reference}?${new URLSearchParams({ token })}`} />;
        })}
      </Suspense>
    </section>
  );
}
