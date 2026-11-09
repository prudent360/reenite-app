import type { Metadata } from "next";
import { Suspense } from "react";
import { EmailTemplatesManager } from "@/components/admin/settings/email-template-editor";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import type { EmailTemplate } from "@/lib/types";

export const metadata: Metadata = { title: "Email templates" };

export default function EmailTemplatesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[640px] rounded-2xl" />}>
      <Templates />
    </Suspense>
  );
}

async function Templates() {
  await requireStaff("settings.manage");
  const { data } = await api<{ data: EmailTemplate[] }>("/admin/settings/email-templates");
  return <EmailTemplatesManager templates={data} />;
}
