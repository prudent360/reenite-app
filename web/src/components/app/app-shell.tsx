"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, createContext, use, useState, useSyncExternalStore, type MouseEvent, type ReactNode } from "react";
import { Bell, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, LifeBuoy, Menu, MoreHorizontal, X } from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { adminNav, customerNav, filterNav, type NavItem } from "./nav-config";
import { ThemeSwitcher } from "./theme-switcher";

type Area = "customer" | "admin";

const ShellContext = createContext<{ collapsed: boolean }>({ collapsed: false });

const COLLAPSE_KEY = "reenite.sidebar.collapsed";
const COLLAPSE_EVENT = "reenite:sidebar";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    // Storage may be unavailable (private mode); default to expanded.
    return false;
  }
}

function writeCollapsed(value: boolean) {
  try {
    localStorage.setItem(COLLAPSE_KEY, value ? "1" : "0");
  } catch {}
  window.dispatchEvent(new Event(COLLAPSE_EVENT));
}

function subscribeCollapsed(onChange: () => void) {
  window.addEventListener(COLLAPSE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(COLLAPSE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function AppShell({
  area,
  nav,
  search,
  userMenu,
  children,
}: {
  area: Area;
  /** Sidebar navigation. For admins this streams in once permissions are known. */
  nav: ReactNode;
  /** The "Search or jump to" trigger and command palette. */
  search: ReactNode;
  userMenu: ReactNode;
  children: ReactNode;
}) {
  const storedCollapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  const [mobileOpen, setMobileOpen] = useState(false);
  // Following any link inside the drawer closes it.
  const closeOnLink = (event: MouseEvent) => {
    if ((event.target as Element).closest("a")) {
      setMobileOpen(false);
    }
  };
  // The mobile drawer is always full width, whatever the desktop preference.
  const collapsed = storedCollapsed && !mobileOpen;
  const home = area === "admin" ? "/admin" : "/dashboard";

  return (
    <ShellContext value={{ collapsed }}>
      <div className="min-h-dvh">
        {mobileOpen && (
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-40 bg-navy-950/50 backdrop-blur-sm lg:hidden"
          />
        )}

        <aside
          onClick={closeOnLink}
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-sidebar transition-[transform,width] duration-200 print:hidden",
            mobileOpen ? "translate-x-0 shadow-pop" : "-translate-x-full lg:translate-x-0",
            collapsed ? "lg:w-20" : "lg:w-68",
          )}
        >
          <div className={cn("flex h-18 shrink-0 items-center justify-between px-6", collapsed && "lg:justify-center lg:px-0")}>
            {collapsed ? (
              <Link href={home} aria-label="Home">
                <LogoMark className="size-9" dotClassName="fill-navy-900 dark:fill-white" />
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <Logo tone="auto" href={home} className="h-8" />
                {area === "admin" && (
                  <span className="rounded-md bg-brand-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Admin</span>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-muted lg:hidden"
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Floating collapse handle on the sidebar edge (desktop only). */}
          <button
            type="button"
            onClick={() => writeCollapsed(!storedCollapsed)}
            className="absolute -right-4 top-6 hidden size-8 items-center justify-center rounded-full border border-border bg-surface text-muted shadow-card transition hover:text-foreground lg:flex"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </button>

          <div className="flex-1 overflow-y-auto px-4 pb-4 pt-2">
            <Suspense fallback={<SidebarNavSkeleton />}>{nav}</Suspense>
          </div>

          <div className={cn("shrink-0 space-y-3 border-t border-border p-4", collapsed && "lg:flex lg:flex-col lg:items-center lg:px-2")}>
            {area === "customer" ? (
              <Link
                href="/dashboard/messages"
                title="Support"
                className={cn(
                  "flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-500 text-sm font-semibold text-white shadow-sm shadow-brand-500/30 transition hover:bg-brand-600",
                  collapsed && "lg:size-11",
                )}
              >
                <LifeBuoy className="size-[18px]" />
                <span className={cn(collapsed && "lg:hidden")}>Support</span>
              </Link>
            ) : (
              <Link
                href="/"
                title="View website"
                className={cn(
                  "flex h-11 items-center justify-center gap-2 rounded-xl bg-navy-900 text-sm font-semibold text-white transition hover:bg-navy-800 dark:bg-navy-700",
                  collapsed && "lg:size-11",
                )}
              >
                <ExternalLink className="size-[18px]" />
                <span className={cn(collapsed && "lg:hidden")}>View website</span>
              </Link>
            )}
            {collapsed ? <ThemeSwitcher compact /> : <ThemeSwitcher />}
          </div>
        </aside>

        <div className={cn("flex min-h-dvh flex-col transition-[padding] duration-200 print:pl-0", collapsed ? "lg:pl-20" : "lg:pl-68")}>
          <header className="sticky top-0 z-30 flex h-18 items-center gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur sm:px-6 lg:px-8 print:hidden">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="-ml-1 flex size-10 shrink-0 items-center justify-center rounded-lg text-foreground hover:bg-surface-muted lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </button>
            <div className="min-w-0 flex-1">{search}</div>
            <button
              type="button"
              className="relative flex size-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-muted hover:text-foreground"
              aria-label="Notifications"
            >
              <Bell className="size-5" />
            </button>
            <span className="hidden h-8 w-px bg-border sm:block" aria-hidden />
            {userMenu}
          </header>

          <main className={cn("mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8", area === "customer" && "pb-28 lg:pb-10")}>
            {children}
          </main>
        </div>

        {area === "customer" && (
          <Suspense fallback={<MobileTabBar pathname={null} onMore={() => setMobileOpen(true)} />}>
            <ActiveMobileTabBar onMore={() => setMobileOpen(true)} />
          </Suspense>
        )}
      </div>
    </ShellContext>
  );
}

function isActive(pathname: string, href: string) {
  return href === "/dashboard" || href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function itemActive(pathname: string, item: NavItem) {
  return item.children ? item.children.some((child) => isActive(pathname, child.href)) : isActive(pathname, item.href);
}

/** Among a section's plain rows, the longest matching href wins (so "My bookings" isn't active on "Book a space"). */
function activeRowHref(pathname: string, items: NavItem[]): string | undefined {
  return items
    .filter((item) => !item.children && isActive(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

/** Within a group, the child with the longest matching href wins (so "All services" isn't active on Categories). */
function activeChildHref(pathname: string, item: NavItem): string | undefined {
  return (item.children ?? [])
    .filter((child) => isActive(pathname, child.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

/**
 * Sectioned sidebar navigation; `allowed` limits admin items to the user's permissions.
 * The URL isn't known while prerendering dynamic routes, so the active highlight streams in.
 */
export function SidebarNav(props: { area: Area; allowed?: string[] }) {
  return (
    <Suspense fallback={<SidebarNavView {...props} pathname="" />}>
      <ActiveSidebarNav {...props} />
    </Suspense>
  );
}

function ActiveSidebarNav(props: { area: Area; allowed?: string[] }) {
  return <SidebarNavView {...props} pathname={usePathname()} />;
}

function SidebarNavView({ area, allowed, pathname }: { area: Area; allowed?: string[]; pathname: string }) {
  const { collapsed } = use(ShellContext);
  const sections = filterNav(area === "admin" ? adminNav : customerNav, allowed);
  const [closedSections, setClosedSections] = useState<string[]>([]);

  const toggleSection = (title: string) =>
    setClosedSections((current) => (current.includes(title) ? current.filter((value) => value !== title) : [...current, title]));

  return (
    <nav aria-label="Main" className={cn("space-y-5", collapsed && "lg:space-y-3")}>
      {sections.map((section) => {
        const hasActive = section.items.some((item) => itemActive(pathname, item));
        // A section holding the current page can't be folded away.
        const open = hasActive || !closedSections.includes(section.title);

        return (
          <div key={section.title}>
            {collapsed ? (
              <div className="mx-auto mb-2 hidden h-px w-8 bg-border lg:block" aria-hidden />
            ) : null}
            <button
              type="button"
              onClick={() => toggleSection(section.title)}
              aria-expanded={open}
              className={cn(
                "mb-1.5 flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]",
                hasActive ? "text-brand-600" : "text-muted hover:text-foreground",
                collapsed && "lg:hidden",
              )}
            >
              {section.title}
              <ChevronDown className={cn("size-3.5 transition-transform", !open && "-rotate-90")} />
            </button>
            {(open || collapsed) && (
              <ul className="space-y-1">
                {section.items.map((item) => (
                  <li key={item.label}>
                    {item.children ? (
                      <NavGroup item={item} pathname={pathname} collapsed={collapsed} />
                    ) : (
                      <NavRow item={item} active={item.href === activeRowHref(pathname, section.items)} collapsed={collapsed} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function NavRow({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-11 items-center gap-3 rounded-xl px-2 text-[15px] font-medium transition-all",
        active
          ? "bg-gradient-to-r from-navy-900 to-navy-700 text-white shadow-pill dark:from-navy-700 dark:to-navy-600"
          : "text-foreground/85 hover:bg-surface-muted hover:text-foreground",
        collapsed && "lg:justify-center lg:px-0",
      )}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
          active ? "bg-white/15 text-white" : "text-muted group-hover:text-foreground",
        )}
      >
        <item.icon className="size-[18px]" />
      </span>
      <span className={cn("truncate", collapsed && "lg:hidden")}>{item.label}</span>
      {active && <span className={cn("ml-auto mr-1.5 size-1.5 rounded-full bg-brand-500", collapsed && "lg:hidden")} />}
    </Link>
  );
}

function NavGroup({ item, pathname, collapsed }: { item: NavItem; pathname: string; collapsed: boolean }) {
  const active = itemActive(pathname, item);
  const [toggled, setToggled] = useState(false);
  const open = active !== toggled; // starts open on its own pages, closed elsewhere
  const children = item.children ?? [];

  if (collapsed) {
    // Icon-only rail: the parent jumps straight to its first child.
    return <NavRow item={{ ...item, href: children[0]?.href ?? item.href }} active={active} collapsed />;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setToggled((value) => !value)}
        aria-expanded={open}
        className={cn(
          "group flex h-11 w-full items-center gap-3 rounded-xl px-2 text-[15px] font-medium transition-colors hover:bg-surface-muted",
          active ? "text-foreground" : "text-foreground/85",
        )}
      >
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", active ? "bg-brand-50 text-brand-600" : "text-muted")}>
          <item.icon className="size-[18px]" />
        </span>
        <span className="truncate">{item.label}</span>
        <ChevronDown className={cn("ml-auto mr-1.5 size-4 text-muted transition-transform", !open && "-rotate-90")} />
      </button>
      {open && (
        <ul className="ml-6 mt-1 space-y-0.5 border-l border-border pl-4">
          {children.map((child) => {
            const childActive = child.href === activeChildHref(pathname, item);
            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  aria-current={childActive ? "page" : undefined}
                  className={cn(
                    "flex h-9 items-center gap-2.5 rounded-lg px-2 text-sm transition-colors",
                    childActive ? "font-semibold text-brand-600" : "text-muted hover:text-foreground",
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", childActive ? "bg-brand-500" : "bg-navy-200 dark:bg-navy-400")} />
                  {child.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function SidebarNavSkeleton() {
  return (
    <div className="space-y-2 px-1" aria-hidden>
      {Array.from({ length: 7 }, (_, index) => (
        <div key={index} className="skeleton h-11 rounded-xl" />
      ))}
    </div>
  );
}

function ActiveMobileTabBar({ onMore }: { onMore: () => void }) {
  return <MobileTabBar pathname={usePathname()} onMore={onMore} />;
}

function MobileTabBar({ pathname, onMore }: { pathname: string | null; onMore: () => void }) {
  const tabs = customerNav.flatMap((section) => section.items).filter((item) => item.tab);

  return (
    <nav
      aria-label="Quick"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden print:hidden"
    >
      <ul className="grid grid-cols-5">
        {tabs.map((item) => {
          const active = pathname !== null && isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn("flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium", active ? "text-brand-600" : "text-muted")}
              >
                <item.icon className="size-5" />
                {item.label === "Book a space" ? "Workspace" : item.label === "Dashboard" ? "Home" : item.label}
              </Link>
            </li>
          );
        })}
        <li>
          <button type="button" onClick={onMore} className="flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted">
            <MoreHorizontal className="size-5" />
            More
          </button>
        </li>
      </ul>
    </nav>
  );
}
