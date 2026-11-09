"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LogOut, Settings, UserRound } from "lucide-react";
import { logout } from "@/lib/actions/auth";
import type { User } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { DotLoader } from "@/components/ui/loader";
import { useFormStatus } from "react-dom";

export function UserMenu({ user, settingsHref }: { user: Pick<User, "name" | "email" | "avatar_url" | "roles">; settingsHref: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !ref.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account menu for ${user.name}`}
        className="flex items-center rounded-full p-0.5 ring-2 ring-transparent transition hover:ring-brand-500/40"
      >
        <Avatar name={user.name} src={user.avatar_url} className="size-10" />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-border bg-surface shadow-pop">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <Avatar name={user.name} src={user.avatar_url} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-brand-600">{user.roles[0]?.label ?? "Member"}</p>
            </div>
          </div>
          <div className="p-1.5">
            <Link role="menuitem" href={settingsHref} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-surface-muted">
              <UserRound className="size-4 text-muted" /> Profile
            </Link>
            <Link role="menuitem" href={settingsHref} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-surface-muted">
              <Settings className="size-4 text-muted" /> Settings
            </Link>
            <form action={signOut}>
              <SignOutButton />
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

async function signOut() {
  await logout();
  // Hard navigation drops every cached and hidden page from this session.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign("/login");
}

function SignOutButton() {
  const { pending } = useFormStatus();
  return (
    <button role="menuitem" type="submit" disabled={pending} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-danger hover:bg-danger-soft">
      <LogOut className="size-4" /> {pending ? <DotLoader className="text-danger" label="Signing out" /> : "Sign out"}
    </button>
  );
}

export function UserMenuSkeleton() {
  return (
    <div className="p-0.5" aria-hidden>
      <span className="skeleton block size-10 rounded-full" />
    </div>
  );
}
