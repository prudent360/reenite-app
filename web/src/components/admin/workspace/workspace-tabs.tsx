"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { workspaceLinks } from "@/components/app/nav-config";
import { cn } from "@/lib/utils";

export function WorkspaceTabs() {
  return (
    <Suspense fallback={<Tabs pathname="" />}>
      <ActiveTabs />
    </Suspense>
  );
}

function ActiveTabs() {
  return <Tabs pathname={usePathname()} />;
}

/** Locations is the section root, so it only matches its own pages. */
function isActive(pathname: string, href: string) {
  if (href === "/admin/workspace") return pathname === href || pathname.startsWith("/admin/workspace/locations");
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Tabs({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Workspace sections" className="-mx-1 mb-6 flex gap-1 overflow-x-auto border-b border-border px-1">
      {workspaceLinks.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition-colors",
              active ? "border-brand-500 text-foreground" : "border-transparent text-muted hover:text-foreground",
            )}
          >
            <link.icon className="size-4" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
