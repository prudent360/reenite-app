"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ComponentType } from "react";
import {
  Bell,
  CalendarCheck,
  CalendarClock,
  CheckCheck,
  CreditCard,
  FileSignature,
  KeyRound,
  Mail,
  MessagesSquare,
  Package,
  ShieldCheck,
  Ticket,
} from "lucide-react";
import { loadNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/actions/notifications";
import type { AppNotification, NotificationFeed } from "@/lib/types";
import { cn } from "@/lib/utils";

type Feed = NotificationFeed & { loadedAt: number };

/** One icon per email-template group, so a payment looks different from a booking at a glance. */
const groupIcons: Record<string, ComponentType<{ className?: string }>> = {
  Account: KeyRound,
  Billing: CreditCard,
  Orders: Package,
  Bookings: CalendarCheck,
  "Passes and memberships": Ticket,
  "Virtual office": Mail,
  Compliance: ShieldCheck,
  Consultations: MessagesSquare,
  Appointments: CalendarClock,
  Documents: FileSignature,
  "Staff alerts": Bell,
};

/** Staff alerts are about something specific, so they take that thing's icon. */
const eventIcons: Record<string, ComponentType<{ className?: string }>> = {
  staff_order_assigned: Package,
  staff_transfer_to_review: CreditCard,
  staff_new_booking: CalendarCheck,
  staff_mail_request: Mail,
  staff_new_consultation: MessagesSquare,
  staff_appointment_reschedule: CalendarClock,
};

/** Checks for new ones this often while the page is open, and whenever the tab comes back into view. */
const POLL_MS = 60_000;

function timeAgo(value: string | null, now: number): string {
  if (!value) {
    return "";
  }
  const minutes = Math.max(0, Math.round((now - new Date(value).getTime()) / 60_000));
  if (minutes < 1) {
    return "Just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.round(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }
  return new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", timeZone: "Africa/Lagos" }).format(new Date(value));
}

export function NotificationMenu({ initial }: { initial: Feed }) {
  const [feed, setFeed] = useState(initial);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Keep the dot current without a reload.
  useEffect(() => {
    let active = true;
    const reload = () => {
      if (document.visibilityState === "visible") {
        loadNotifications().then((next) => active && setFeed(next));
      }
    };
    const timer = window.setInterval(reload, POLL_MS);
    document.addEventListener("visibilitychange", reload);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", reload);
    };
  }, []);

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

  const toggle = () => {
    if (!open) {
      loadNotifications().then(setFeed);
    }
    setOpen(!open);
  };

  const markRead = (notification: AppNotification) => {
    setOpen(false);
    if (notification.read) {
      return;
    }
    setFeed((current) => ({
      ...current,
      unread_count: Math.max(0, current.unread_count - 1),
      data: current.data.map((item) => (item.id === notification.id ? { ...item, read: true } : item)),
    }));
    void markNotificationRead(notification.id);
  };

  const markAllRead = () => {
    setFeed((current) => ({ ...current, unread_count: 0, data: current.data.map((item) => ({ ...item, read: true })) }));
    void markAllNotificationsRead();
  };

  const unread = feed.unread_count;

  return (
    <div ref={ref} className="sm:relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative flex size-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-muted hover:text-foreground"
      >
        <Bell className="size-5" />
        {unread > 0 && <span className="absolute right-2 top-2 size-2.5 rounded-full bg-danger ring-2 ring-surface" aria-hidden />}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="fixed inset-x-4 top-16 z-50 overflow-hidden rounded-2xl border border-border bg-surface shadow-pop sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <p className="font-semibold">
              Notifications
              {unread > 0 && <span className="ml-2 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger">{unread} new</span>}
            </p>
            {unread > 0 && (
              <button type="button" onClick={markAllRead} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
                <CheckCheck className="size-4" /> Mark all read
              </button>
            )}
          </div>

          {feed.data.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Bell className="mx-auto size-8 text-muted/60" />
              <p className="mt-3 font-medium">Nothing yet</p>
              <p className="mt-1 text-sm text-muted">Payments, bookings and order updates will show up here.</p>
            </div>
          ) : (
            <ul className="max-h-[min(28rem,calc(100dvh-8rem))] divide-y divide-border overflow-y-auto">
              {feed.data.map((notification) => (
                <li key={notification.id}>
                  <NotificationRow notification={notification} now={feed.loadedAt} onOpen={() => markRead(notification)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationRow({ notification, now, onOpen }: { notification: AppNotification; now: number; onOpen: () => void }) {
  const Icon = eventIcons[notification.event ?? ""] ?? groupIcons[notification.group ?? ""] ?? Bell;
  const className = cn("flex w-full gap-3 px-4 py-3 text-left transition hover:bg-surface-muted", !notification.read && "bg-brand-50/50");
  const content = (
    <>
      <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full", notification.read ? "bg-surface-muted text-muted" : "bg-brand-50 text-brand-600")}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className={cn("text-sm", notification.read ? "font-medium text-foreground/80" : "font-semibold text-foreground")}>{notification.title}</span>
          <span className="shrink-0 text-xs text-muted">{timeAgo(notification.created_at, now)}</span>
        </span>
        <span className="mt-0.5 line-clamp-2 block text-sm text-muted">{notification.body}</span>
      </span>
      {!notification.read && <span className="mt-2 size-2 shrink-0 rounded-full bg-danger" aria-label="Unread" />}
    </>
  );

  if (!notification.url) {
    return (
      <button type="button" onClick={onOpen} className={className}>
        {content}
      </button>
    );
  }
  return notification.url.startsWith("/") ? (
    <Link href={notification.url} onClick={onOpen} className={className}>
      {content}
    </Link>
  ) : (
    <a href={notification.url} onClick={onOpen} className={className}>
      {content}
    </a>
  );
}

/** Shown while the first load streams in: the same bell, without the dot. */
export function NotificationMenuSkeleton() {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted" aria-hidden>
      <Bell className="size-5" />
    </span>
  );
}
