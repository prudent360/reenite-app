import { Suspense } from "react";
import { AppShell, SidebarNav } from "@/components/app/app-shell";
import { CommandPalette } from "@/components/app/command-palette";
import { NotificationMenu, NotificationMenuSkeleton } from "@/components/app/notification-menu";
import { StaffSessionBanner } from "@/components/app/staff-session-banner";
import { UserMenu, UserMenuSkeleton } from "@/components/app/user-menu";
import { loadNotifications } from "@/lib/actions/notifications";
import { requireCustomer } from "@/lib/session";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <AppShell
      area="customer"
      nav={<SidebarNav area="customer" />}
      search={<CommandPalette area="customer" />}
      bell={
        <Suspense fallback={<NotificationMenuSkeleton />}>
          <Notifications />
        </Suspense>
      }
      userMenu={
        <Suspense fallback={<UserMenuSkeleton />}>
          <CustomerUserMenu />
        </Suspense>
      }
    >
      <Suspense fallback={null}>
        <StaffSession />
      </Suspense>
      {children}
    </AppShell>
  );
}

async function CustomerUserMenu() {
  const user = await requireCustomer();
  return (
    <UserMenu
      user={{ name: user.name, email: user.email, avatar_url: user.avatar_url, roles: user.roles }}
      settingsHref="/dashboard/settings"
    />
  );
}

async function StaffSession() {
  const user = await requireCustomer();
  return user.signed_in_by ? <StaffSessionBanner customerName={user.name} staffName={user.signed_in_by.name} /> : null;
}

async function Notifications() {
  await requireCustomer();
  return <NotificationMenu initial={await loadNotifications()} />;
}
