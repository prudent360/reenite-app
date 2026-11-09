import type { Metadata } from "next";
import { Suspense } from "react";
import { SignatoryForm } from "@/components/admin/settings/signatory-form";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import type { Signatory } from "@/lib/types";

export const metadata: Metadata = { title: "Signatory" };

export default function SignatorySettingsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  await requireStaff("settings.manage");
  const { data } = await api<{ data: Signatory }>("/admin/settings/signatory");
  return <SignatoryForm key={JSON.stringify(data)} signatory={data} />;
}
