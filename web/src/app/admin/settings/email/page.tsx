import type { Metadata } from "next";
import { Suspense } from "react";
import { MailSettingsForm } from "@/components/admin/settings/mail-settings-form";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import type { MailSettings } from "@/lib/types";

export const metadata: Metadata = { title: "Email delivery" };

export default function EmailDeliveryPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[560px] rounded-2xl" />}>
      <EmailDelivery />
    </Suspense>
  );
}

async function EmailDelivery() {
  const user = await requireStaff("settings.manage");
  const { data } = await api<{ data: MailSettings }>("/admin/settings/mail");
  return <MailSettingsForm settings={data} adminEmail={user.email} />;
}
