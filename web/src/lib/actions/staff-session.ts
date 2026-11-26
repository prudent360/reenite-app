"use server";

import { cookies } from "next/headers";
import { STAFF_TOKEN_COOKIE, TOKEN_COOKIE, api, toFormState } from "@/lib/api";
import { setSessionToken, setStaffTokenAside } from "@/lib/session";
import type { FormState, User } from "@/lib/types";

/**
 * Signs the staff member in as a customer: their own token is kept aside and the browser now uses
 * the customer's short-lived token. The caller does a full page load to `href` so no admin page
 * stays cached in the browser.
 */
export async function signInAsCustomer(customerId: number): Promise<FormState & { href?: string }> {
  const staffToken = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!staffToken) return { ok: false, message: "Your session has expired. Please sign in again." };

  let token: string;
  try {
    ({ token } = await api<{ token: string }>(`/admin/customers/${customerId}/sign-in`, { method: "POST" }));
  } catch (error) {
    return toFormState(error);
  }

  await setStaffTokenAside(staffToken);
  await setSessionToken(token);
  return { ok: true, href: "/dashboard" };
}

/**
 * Ends the customer session and puts the staff member's own session back. Returns where to go:
 * the customer's profile in the admin, or the sign-in page if the staff session is gone too.
 */
export async function backToAdmin(): Promise<string> {
  const store = await cookies();
  const staffToken = store.get(STAFF_TOKEN_COOKIE)?.value;

  let customerId: number | null = null;
  try {
    customerId = (await api<{ data: User }>("/auth/me")).data.id;
    await api("/auth/impersonation", { method: "DELETE" });
  } catch {
    // The customer session may already have expired; restoring the staff session is what matters.
  }

  store.delete(STAFF_TOKEN_COOKIE);
  if (!staffToken) {
    store.delete(TOKEN_COOKIE);
    return "/login";
  }
  await setSessionToken(staffToken);
  return customerId ? `/admin/customers/${customerId}` : "/admin/customers";
}
