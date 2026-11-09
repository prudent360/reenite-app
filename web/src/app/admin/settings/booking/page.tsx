import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingSettingsForm } from "@/components/admin/settings/booking-settings-form";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import type { BookingSettings } from "@/lib/types";

export const metadata: Metadata = { title: "Space booking" };

export default function BookingSettingsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-80 rounded-2xl" />}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  await requireStaff("settings.manage");
  const { data } = await api<{ data: BookingSettings }>("/admin/settings/workspace");
  return <BookingSettingsForm key={JSON.stringify(data)} settings={data} />;
}
