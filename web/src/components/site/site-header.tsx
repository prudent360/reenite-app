"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { ArrowUpRight, Building2, ChevronDown, GraduationCap, ListChecks, MapPinned, MessageCircle, Mic, type LucideIcon } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string; external?: boolean; description?: string; icon?: LucideIcon };

/** A top-level entry is either a plain link or a dropdown of links. */
type NavEntry = NavLink | { label: string; children: NavLink[] };

const solutions: NavLink[] = [
  { href: "/#virtual-address", label: "Virtual address", icon: MapPinned, description: "A business address for CAC filing" },
  { href: "/#podcast", label: "Podcast studio", icon: Mic, description: "Record your show in a real studio" },
  { href: "/#academy", label: "Academy", icon: GraduationCap, description: "Tech training on a scholarship" },
];

const company: NavLink[] = [
  { href: "/#how", label: "How it works", icon: ListChecks, description: "From sign-up to done, step by step" },
  { href: "/about", label: "About", icon: Building2, description: "Who we are and what we do" },
  { href: "/contact", label: "Contact", icon: MessageCircle, description: "Visit, call or WhatsApp us" },
];

function isGroup(entry: NavEntry): entry is { label: string; children: NavLink[] } {
  return "children" in entry;
}

function isActive(link: NavLink, pathname: string) {
  return !link.external && link.href.startsWith("/") && !link.href.startsWith("/#") && link.href.length > 1 && pathname.startsWith(link.href);
}

/** Dotted underline under nav links, as on the reference site. */
const dotted = "bg-[radial-gradient(circle,currentColor_.5px,transparent_.5px)] bg-[size:2.5px_2.5px] bg-[position:center_90%] bg-repeat-x";

/** Pill buttons that dip slightly on hover and press, with a light sweeping across on hover. */

/**
 * `booking` says where "Book a space" goes: this site's /book, or the separate booking site
 * (the admin switch decides).
 */
/**
 * `account` holds the server-rendered sign-in buttons (or "Dashboard" once signed in) for the
 * desktop bar, the compact mobile bar and the mobile menu.
 */
export function SiteHeader({ booking, account }: { booking: { href: string; external: boolean }; account: { bar: ReactNode; compact: ReactNode; menu: ReactNode } }) {
  const bookLink: NavLink = { href: booking.href, label: "Book a space", external: booking.external };
  const entries: NavEntry[] = [
    { href: "/services", label: "Services" },
    { label: "Solutions", children: solutions },
    { label: "Company", children: company },
    bookLink,
  ];
  const mobileGroups: { title?: string; links: NavLink[] }[] = [
    { links: [{ href: "/services", label: "Services" }, bookLink] },
    { title: "Solutions", links: solutions },
    { title: "Company", links: company },
  ];
  const [open, setOpen] = useState(false);
  const [tucked, setTucked] = useState(false);
  const lastY = useRef(0);

  // Slide away while scrolling down the page and come back on the way up, like the reference site.
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - lastY.current) < 6) {
        return;
      }
      setTucked(y > lastY.current && y > 160);
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // While the full-screen menu is open: no page scrolling behind it, and Escape closes it.
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.documentElement.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 bg-navy-950 text-white print:hidden transition-transform duration-[450ms] ease-[cubic-bezier(0.25,0.1,0.25,1)] motion-reduce:transition-none",
        tucked && !open && "-translate-y-full",
      )}
    >
      <div className="intro-header relative z-[60] mx-auto flex h-18 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        <Logo tone="light" className="h-7 sm:h-8" />

        <nav aria-label="Main" className="hidden items-center gap-7 lg:flex">
          {/* The URL isn't known while prerendering dynamic routes, so the highlight streams in. */}
          <Suspense fallback={<HeaderLinks entries={entries} pathname="" />}>
            <ActiveHeaderLinks entries={entries} />
          </Suspense>
        </nav>

        <div className="hidden items-center gap-3 lg:flex">{account.bar}</div>

        <div className="flex items-center gap-3 lg:hidden">
          {account.compact}
          <button
            type="button"
            className="relative -mr-1 flex size-10 items-center justify-center"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {/* Three bars that fold into a cross. */}
            <span aria-hidden className="relative block h-4 w-5">
              <span className={cn("absolute left-0 h-0.5 w-full rounded-full bg-white transition-all duration-300", open ? "top-[7px] rotate-45" : "top-0")} />
              <span className={cn("absolute left-0 top-[7px] h-0.5 w-full rounded-full bg-white transition-opacity duration-200", open ? "opacity-0" : "opacity-100")} />
              <span className={cn("absolute left-0 h-0.5 w-full rounded-full bg-white transition-all duration-300", open ? "top-[7px] -rotate-45" : "top-[14px]")} />
            </span>
          </button>
        </div>
      </div>

      {/* Full-screen menu that drops down from the top; links arrive one after another. */}
      <div
        id="mobile-menu"
        inert={!open}
        onClick={(event) => (event.target as Element).closest("a") && setOpen(false)}
        className={cn(
          "fixed inset-0 z-50 flex flex-col justify-between bg-gradient-to-b from-navy-950 to-navy-800 px-6 pb-12 pt-28 transition-transform duration-500 ease-in-out motion-reduce:transition-none lg:hidden",
          open ? "translate-y-0" : "-translate-y-full",
        )}
      >
        <nav aria-label="Mobile" className="flex flex-col gap-8 overflow-y-auto">
          {mobileGroups.map((group, groupIndex) => (
            <div key={group.title ?? "main"} className="flex flex-col gap-3">
              {group.title && (
                <p
                  style={{ transitionDelay: open ? `${250 + groupIndex * 140}ms` : "0ms" } as CSSProperties}
                  className={cn("text-sm font-medium text-navy-300 transition-all duration-300 motion-reduce:transition-none", open ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0")}
                >
                  {group.title}
                </p>
              )}
              {group.links.map((link, index) => (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{ transitionDelay: open ? `${250 + groupIndex * 140 + index * 60}ms` : "0ms" } as CSSProperties}
                  className={cn(
                    "flex items-center gap-2 font-semibold text-white transition-all duration-300 motion-reduce:transition-none",
                    group.title ? "text-xl" : "text-3xl",
                    open ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
                  )}
                >
                  <span className={cn(dotted, group.title ? "leading-9" : "leading-[3rem]")}>{link.label}</span>
                  {link.external && <ArrowUpRight className="size-5 text-navy-200" />}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div
          style={{ transitionDelay: open ? "700ms" : "0ms" } as CSSProperties}
          className={cn("mt-8 grid shrink-0 grid-cols-2 gap-3 transition-all duration-300 motion-reduce:transition-none", open ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0")}
        >
          {account.menu}
        </div>
      </div>
    </header>
  );
}

function ActiveHeaderLinks({ entries }: { entries: NavEntry[] }) {
  return <HeaderLinks entries={entries} pathname={usePathname()} />;
}

const topLink = "flex items-center gap-1 py-1 text-sm font-medium leading-5 transition-colors duration-150";

function HeaderLinks({ entries, pathname }: { entries: NavEntry[]; pathname: string }) {
  return entries.map((entry) =>
    isGroup(entry) ? (
      <HeaderDropdown key={entry.label} label={entry.label} links={entry.children} pathname={pathname} />
    ) : (
      <Link
        key={entry.href}
        href={entry.href}
        className={cn(topLink, dotted, isActive(entry, pathname) ? "text-white" : "text-navy-200 hover:text-white")}
      >
        {entry.label}
        {entry.external && <ArrowUpRight className="size-3.5" />}
      </Link>
    ),
  );
}

/** A label that opens a small panel of links on hover, click or keyboard. */
function HeaderDropdown({ label, links, pathname }: { label: string; links: NavLink[]; pathname: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const active = links.some((link) => isActive(link, pathname));

  // Close on a click elsewhere or on Escape (picking a link closes it too).
  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointer = (event: PointerEvent) => !root.current?.contains(event.target as Node) && setOpen(false);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        root.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const hoverOpen = (event: ReactPointerEvent) => {
    if (event.pointerType !== "mouse") {
      return;
    }
    clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hoverClose = (event: ReactPointerEvent) => {
    if (event.pointerType !== "mouse") {
      return;
    }
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };
  const id = `nav-${label.toLowerCase()}`;

  return (
    <div
      ref={root}
      className="relative"
      onPointerEnter={hoverOpen}
      onPointerLeave={hoverClose}
      onBlur={(event) => !root.current?.contains(event.relatedTarget as Node) && setOpen(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className={cn(topLink, dotted, active || open ? "text-white" : "text-navy-200 hover:text-white")}
      >
        {label}
        <ChevronDown className={cn("size-3.5 transition-transform duration-200", open && "rotate-180")} />
      </button>

      {/* pt-3 bridges the gap so the pointer can travel from the label to the panel. */}
      <div
        id={id}
        inert={!open}
        className={cn(
          "absolute left-1/2 top-full z-50 w-80 -translate-x-1/2 pt-3 transition-all duration-200 motion-reduce:transition-none",
          open ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0",
        )}
      >
        <div className="rounded-md border border-white/10 bg-navy-900 p-2 shadow-xl shadow-black/30">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-start gap-3 rounded-md px-3 py-2.5 transition-colors duration-150 hover:bg-white/5 focus-visible:bg-white/5",
                isActive(link, pathname) && "bg-white/5",
              )}
            >
              {link.icon && (
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-white/5 text-brand-400">
                  <link.icon className="size-4" />
                </span>
              )}
              <span>
                <span className="block text-sm font-medium text-white">{link.label}</span>
                {link.description && <span className="mt-0.5 block text-[13px] leading-snug text-navy-300">{link.description}</span>}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
