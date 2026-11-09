import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { BookingView } from "@/components/booking/booking-view";
import { Skeleton } from "@/components/ui/loader";
import { requireCustomer } from "@/lib/session";

export const metadata: Metadata = { title: "Your booking" };

export default function DashboardBookingPage({ params, searchParams }: PageProps<"/dashboard/workspace/[reference]">) {
  return (
    <>
      <Link href="/dashboard/workspace" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Workspace
      </Link>
      <Suspense fallback={<Skeleton className="h-[520px] rounded-2xl" />}>
        {Promise.all([params, searchParams]).then(([{ reference }, query]) => (
          <Booking reference={reference} token={typeof query.token === "string" ? query.token : ""} paid={query.paid === "1"} />
        ))}
      </Suspense>
    </>
  );
}

async function Booking({ reference, token, paid }: { reference: string; token: string; paid: boolean }) {
  await requireCustomer();
  return <BookingView reference={reference} token={token} paid={paid} inDashboard />;
}
