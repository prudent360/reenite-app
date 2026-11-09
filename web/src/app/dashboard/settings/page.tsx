import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { SettingsContent, SettingsSkeleton } from "@/components/app/settings-content";
import { requireCustomer } from "@/lib/session";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Manage your profile and sign-in details." />
      <Suspense fallback={<SettingsSkeleton />}>
        <CustomerSettings />
      </Suspense>
    </>
  );
}

async function CustomerSettings() {
  return <SettingsContent user={await requireCustomer()} />;
}
