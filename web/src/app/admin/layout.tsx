import type { Metadata } from "next";
import { Suspense } from "react";
import { AppShell, SidebarNav, SidebarNavSkeleton } from "@/components/app/app-shell";
import { CommandPalette, CommandPaletteSkeleton } from "@/components/app/command-palette";
import { allowedAdminHrefs } from "@/components/app/nav-config";
import { UserMenu, UserMenuSkeleton } from "@/components/app/user-menu";
import { requireStaff } from "@/lib/session";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Reenite Admin" },
  robots: { index: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <AppShell
      area="admin"
      nav={
        <Suspense fallback={<SidebarNavSkeleton />}>
          <AdminNav />
        </Suspense>
      }
      search={
        <Suspense fallback={<CommandPaletteSkeleton />}>
          <AdminSearch />
        </Suspense>
      }
      userMenu={
        <Suspense fallback={<UserMenuSkeleton />}>
          <StaffUserMenu />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}

async function AdminNav() {
  const user = await requireStaff();
  return <SidebarNav area="admin" allowed={allowedAdminHrefs(user.permissions ?? [])} />;
}

async function AdminSearch() {
  const user = await requireStaff();
  return <CommandPalette area="admin" allowed={allowedAdminHrefs(user.permissions ?? [])} />;
}

async function StaffUserMenu() {
  const user = await requireStaff();
  return (
    <UserMenu
      user={{ name: user.name, email: user.email, avatar_url: user.avatar_url, roles: user.roles }}
      settingsHref="/admin/profile"
    />
  );
}
