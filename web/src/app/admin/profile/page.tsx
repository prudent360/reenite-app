import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { SettingsContent, SettingsSkeleton } from "@/components/app/settings-content";
import { requireStaff } from "@/lib/session";

export const metadata: Metadata = { title: "My profile" };

export default function StaffProfilePage() {
  return (
    <>
      <PageHeader title="My profile" description="Your name, phone and password." />
      <Suspense fallback={<SettingsSkeleton />}>
        <StaffSettings />
      </Suspense>
    </>
  );
}

async function StaffSettings() {
  return <SettingsContent user={await requireStaff()} />;
}
