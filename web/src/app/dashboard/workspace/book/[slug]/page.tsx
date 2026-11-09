import type { Metadata } from "next";
import { DashboardBooking } from "@/components/booking/dashboard-booking";

export const metadata: Metadata = { title: "Book a space" };

/** Opens the booking at the Time step with this space chosen. */
export default function DashboardBookSpacePage({ params }: PageProps<"/dashboard/workspace/book/[slug]">) {
  return <DashboardBooking slug={params.then(({ slug }) => slug)} />;
}
