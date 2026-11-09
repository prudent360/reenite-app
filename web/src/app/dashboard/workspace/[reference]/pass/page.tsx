import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingPass } from "@/components/booking/booking-pass";
import { Skeleton } from "@/components/ui/loader";
import { requireCustomer } from "@/lib/session";

export const metadata: Metadata = { title: "Booking pass" };

export default function DashboardBookingPassPage({ params }: PageProps<"/dashboard/workspace/[reference]/pass">) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-[560px] max-w-xl rounded-3xl" />}>
      {params.then(({ reference }) => (
        <Pass reference={reference} />
      ))}
    </Suspense>
  );
}

async function Pass({ reference }: { reference: string }) {
  await requireCustomer();
  return <BookingPass reference={reference} token="" backHref={`/dashboard/workspace/${reference}`} />;
}
