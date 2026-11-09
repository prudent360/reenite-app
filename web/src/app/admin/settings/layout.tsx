import { SettingsTabs } from "@/components/admin/settings/settings-tabs";
import { PageHeader } from "@/components/app/page-header";

export default function SettingsLayout({ children }: LayoutProps<"/admin/settings">) {
  return (
    <>
      <PageHeader title="Settings" description="Payments, bank transfer, emails, space booking and the signatory on legal documents. Only Super Admins can change these." />
      <SettingsTabs />
      {children}
    </>
  );
}
