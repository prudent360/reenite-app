import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { API_URL, RETRY_SOON } from "./api";
import type { BookingSettings, WorkspaceCatalogue } from "./types";

export const BOOKING_SETTINGS_TAG = "booking-settings";
export const WORKSPACE_TAG = "workspace";

const fallback: BookingSettings = { destination: "external", external_url: "https://book.reenite.com" };

/**
 * Where "Book a space" goes: this site (`/book`) or the separate booking site. Cached and
 * refreshed when an admin flips the switch (updateTag(BOOKING_SETTINGS_TAG)).
 */
export async function getBookingSettings(): Promise<BookingSettings> {
  "use cache";
  cacheTag(BOOKING_SETTINGS_TAG);

  try {
    const response = await fetch(`${API_URL}/api/v1/workspace/booking-settings`, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      throw new Error(`Booking settings request failed with ${response.status}`);
    }
    cacheLife("hours");
    return (await response.json()) as BookingSettings;
  } catch (error) {
    console.error(error);
    cacheLife(RETRY_SOON);
    return fallback;
  }
}

/** The link every "Book a space" button uses. */
export function bookingHref(settings: BookingSettings, path = ""): string {
  return settings.destination === "internal" ? `/book${path}` : `${settings.external_url}${path === "" ? "" : "/book"}`;
}

/** Bookable locations and spaces with their prices, plus passes and memberships on sale. */
export async function getWorkspaceCatalogue(): Promise<WorkspaceCatalogue | null> {
  "use cache";
  cacheTag(WORKSPACE_TAG);

  try {
    const response = await fetch(`${API_URL}/api/v1/workspace`, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      throw new Error(`Workspace request failed with ${response.status}`);
    }
    cacheLife("minutes");
    return (await response.json()) as WorkspaceCatalogue;
  } catch (error) {
    console.error(error);
    cacheLife(RETRY_SOON);
    return null;
  }
}
