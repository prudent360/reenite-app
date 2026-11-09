import type { Metadata } from "next";
import { DashboardBooking } from "@/components/booking/dashboard-booking";

export const metadata: Metadata = { title: "Book a space" };

export default function DashboardBookPage() {
  return <DashboardBooking slug={null} />;
}
