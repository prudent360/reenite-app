import { Suspense } from "react";
import { AppShell, SidebarNav } from "@/components/app/app-shell";
import { CommandPalette } from "@/components/app/command-palette";
import { UserMenu, UserMenuSkeleton } from "@/components/app/user-menu";
import { requireCustomer } from "@/lib/session";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <AppShell
      area="customer"
      nav={<SidebarNav area="customer" />}
      search={<CommandPalette area="customer" />}
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
