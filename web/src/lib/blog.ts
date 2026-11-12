import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { API_URL, RETRY_SOON } from "./api";
import type { BlogIndex, BlogPost } from "./types";

export const BLOG_TAG = "blog";

/**
 * Published posts, cached across requests and refreshed when staff save a post (Server Actions call
 * updateTag(BLOG_TAG)). The short cache life also lets a scheduled post appear within minutes of its time.
 * `null` means the API couldn't be reached; that's cached only briefly so pages recover on their own.
 */
export async function getPosts({ page = 1, category, perPage = 12 }: { page?: number; category?: string; perPage?: number } = {}): Promise<BlogIndex | null> {
  "use cache";
  cacheTag(BLOG_TAG);

  const query = new URLSearchParams({ page: String(page), per_page: String(perPage) });
  if (category) query.set("category", category);
  try {
    const response = await fetch(`${API_URL}/api/v1/blog?${query}`, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      throw new Error(`Blog request failed with ${response.status}`);
    }
    cacheLife("minutes");
    return (await response.json()) as BlogIndex;
  } catch (error) {
    console.error(error);
    cacheLife(RETRY_SOON);
    return null;
  }
}

/** One published post; `undefined` when there's no such post (or it isn't live yet), `null` when the API failed. */
export async function getPost(slug: string): Promise<BlogPost | undefined | null> {
  "use cache";
  cacheTag(BLOG_TAG);

  try {
    const response = await fetch(`${API_URL}/api/v1/blog/${encodeURIComponent(slug)}`, { headers: { Accept: "application/json" } });
    if (response.status === 404) {
      cacheLife("minutes");
      return undefined;
    }
    if (!response.ok) {
      throw new Error(`Post request failed with ${response.status}`);
    }
    cacheLife("minutes");
    return ((await response.json()) as { data: BlogPost }).data;
  } catch (error) {
    console.error(error);
    cacheLife(RETRY_SOON);
    return null;
  }
}
