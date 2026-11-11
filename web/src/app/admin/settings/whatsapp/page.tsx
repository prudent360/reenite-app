import type { Metadata } from "next";
import { Suspense } from "react";
import { WhatsAppSettingsForm } from "@/components/admin/settings/whatsapp-settings-form";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import type { WhatsAppSettings } from "@/lib/types";

export const metadata: Metadata = { title: "WhatsApp" };

export default function WhatsAppSettingsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[560px] rounded-2xl" />}>
      <WhatsApp />
    </Suspense>
  );
}

async function WhatsApp() {
  await requireStaff("settings.manage");
  const { data } = await api<{ data: WhatsAppSettings }>("/admin/settings/whatsapp");
  return <WhatsAppSettingsForm settings={data} />;
}
