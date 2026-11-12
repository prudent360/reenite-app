"use server";

import { api } from "@/lib/api";
import type { NotificationFeed } from "@/lib/types";

/** The signed-in person's recent notifications. `loadedAt` lets the menu say "5m ago" without reading the clock while rendering. */
export async function loadNotifications(): Promise<NotificationFeed & { loadedAt: number }> {
  try {
    const feed = await api<NotificationFeed>("/notifications");
    return { ...feed, loadedAt: Date.now() };
  } catch {
    return { data: [], unread_count: 0, loadedAt: Date.now() };
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  try {
    await api(`/notifications/${id}/read`, { method: "POST" });
  } catch {
    // Opening the link matters more than the dot; it clears on the next read-all.
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  try {
    await api("/notifications/read", { method: "POST" });
  } catch {
    // The next load shows the true state.
  }
}
