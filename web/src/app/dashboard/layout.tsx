import { Suspense } from "react";
import { AppShell, SidebarNav } from "@/components/app/app-shell";
import { CommandPalette } from "@/components/app/command-palette";
import { NotificationMenu, NotificationMenuSkeleton } from "@/components/app/notification-menu";
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

async function Notifications() {
  await requireCustomer();
  return <NotificationMenu initial={await loadNotifications()} />;
}
