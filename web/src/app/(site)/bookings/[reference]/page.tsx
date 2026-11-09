import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BookingView } from "@/components/booking/booking-view";
import { Skeleton } from "@/components/ui/loader";
import { getOptionalUser } from "@/lib/session";

export const metadata: Metadata = { title: "Your booking", robots: { index: false } };

/** Public booking page for guests (via their private link). Signed-in customers see it in their dashboard. */
export default function BookingPage({ params, searchParams }: PageProps<"/bookings/[reference]">) {
  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <Suspense fallback={<Skeleton className="h-[520px] rounded-2xl" />}>
        {Promise.all([params, searchParams]).then(([{ reference }, query]) => (
          <Guest reference={reference} token={typeof query.token === "string" ? query.token : ""} paid={query.paid === "1"} />
        ))}
      </Suspense>
    </section>
  );
}

async function Guest({ reference, token, paid }: { reference: string; token: string; paid: boolean }) {
  const user = await getOptionalUser();
  if (user?.type === "customer") {
    // Keep the token: it still opens a booking made as a guest before this person signed in.
    const query = new URLSearchParams({ ...(token ? { token } : {}), ...(paid ? { paid: "1" } : {}) });
    redirect(`/dashboard/workspace/${encodeURIComponent(reference)}${query.size ? `?${query}` : ""}`);
  }
  return <BookingView reference={reference} token={token} paid={paid} />;
}
