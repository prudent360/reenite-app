import "server-only";
import { cookies, headers as requestHeaders } from "next/headers";
import type { FormState } from "./types";

export const API_URL = (process.env.API_URL ?? "http://localhost:8000").replace(/\/$/, "");

/**
 * Cache life for a failed API read: retried about a minute later. It stays just above the
 * "short-lived" cut-off (expire of 5 minutes, stale of 30 seconds) on purpose, so a build that
 * can't reach the API still prerenders with the fallback instead of failing.
 */
export const RETRY_SOON = { stale: 30, revalidate: 60, expire: 300 };
export const TOKEN_COOKIE = "reenite_token";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors: Record<string, string[]> = {},
  ) {
    super(message);
  }
}

type ApiOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  /** Skip attaching the session token (e.g. public endpoints). */
  anonymous?: boolean;
};

/**
 * Who the visitor is, for the API's activity log and sign-in limits: their IP and browser.
 * The shared INTERNAL_API_KEY tells the API these headers came from this website, so a
 * stranger calling the API directly can't fake an address.
 */
async function clientHeaders(): Promise<Record<string, string>> {
  const key = process.env.INTERNAL_API_KEY;
  try {
    const incoming = await requestHeaders();
    const ip = incoming.get("x-forwarded-for")?.split(",")[0]?.trim() || incoming.get("x-real-ip") || "";
    const agent = incoming.get("user-agent") ?? "";
    return {
      ...(key ? { "X-Reenite-Client": key } : {}),
      ...(ip ? { "X-Forwarded-For": ip } : {}),
      ...(agent ? { "User-Agent": agent } : {}),
    };
  } catch {
    // Outside a request (build time): nothing to pass on.
    return {};
  }
}

/**
 * Server-side call to the Laravel API. The Sanctum token lives in an httpOnly cookie
 * and never reaches browser JavaScript.
 */
export async function api<T>(path: string, { body, anonymous, headers, ...init }: ApiOptions = {}): Promise<T> {
  const token = anonymous ? undefined : (await cookies()).get(TOKEN_COOKIE)?.value;

  const response = await fetch(`${API_URL}/api/v1${path.startsWith("/") ? path : `/${path}`}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(await clientHeaders()),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(response.status, payload.message ?? "Something went wrong. Please try again.", payload.errors ?? {});
  }

  return payload as T;
}

/** Sends multipart form data (file uploads) to the API with the session token. */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  const response = await fetch(`${API_URL}/api/v1${path}`, {
    method: "POST",
    headers: { Accept: "application/json", ...(await clientHeaders()), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(response.status, payload.message ?? "Upload failed. Please try again.", payload.errors ?? {});
  }
  return payload as T;
}

/** Converts an API failure into the state shape our forms render. */
export function toFormState(error: unknown, values?: Record<string, string>): FormState {
  if (error instanceof ApiError) {
    // Field errors are shown next to their inputs; a 422 without them is a general message to show as-is.
    const hasFieldErrors = Object.keys(error.errors).length > 0;
    return { ok: false, message: error.status === 422 && hasFieldErrors ? undefined : error.message, errors: error.errors, values };
  }
  console.error(error);
  return { ok: false, message: "We couldn't reach the server. Please try again.", values };
}
