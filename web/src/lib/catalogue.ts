import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { API_URL, RETRY_SOON } from "./api";
import type { Catalogue, Service } from "./types";

export const CATALOGUE_TAG = "catalogue";

/**
 * Public catalogue, cached across requests and refreshed when an admin edits services
 * (Server Actions call updateTag(CATALOGUE_TAG)). If the API is unreachable, an empty
 * catalogue is cached only briefly so pages recover on their own.
 */
export async function getCatalogue(): Promise<Catalogue | null> {
  "use cache";
  cacheTag(CATALOGUE_TAG);

  try {
    const response = await fetch(`${API_URL}/api/v1/catalogue`, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      throw new Error(`Catalogue request failed with ${response.status}`);
    }
    cacheLife("minutes");
    return (await response.json()) as Catalogue;
  } catch (error) {
    console.error(error);
    cacheLife(RETRY_SOON);
    return null;
  }
}

/** One public service by slug; `undefined` when it doesn't exist or is hidden, `null` when the API failed. */
export async function getPublicService(slug: string): Promise<Service | undefined | null> {
  "use cache";
  cacheTag(CATALOGUE_TAG);

  try {
    const response = await fetch(`${API_URL}/api/v1/catalogue/services/${encodeURIComponent(slug)}`, {
      headers: { Accept: "application/json" },
    });
    if (response.status === 404) {
      cacheLife("minutes");
      return undefined;
    }
    if (!response.ok) {
      throw new Error(`Service request failed with ${response.status}`);
    }
    cacheLife("minutes");
    return ((await response.json()) as { data: Service }).data;
  } catch (error) {
    console.error(error);
    cacheLife(RETRY_SOON);
    return null;
  }
}
