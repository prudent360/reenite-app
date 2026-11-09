import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { ApiError, TOKEN_COOKIE, api } from "./api";
import type { User } from "./types";

const THIRTY_DAYS = 60 * 60 * 24 * 30;

export async function setSessionToken(token: string) {
  (await cookies()).set(TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: THIRTY_DAYS,
  });
}

export async function clearSessionToken() {
  (await cookies()).delete(TOKEN_COOKIE);
}

/** The signed-in user, or null. Deduplicated per request. */
export const getOptionalUser = cache(async (): Promise<User | null> => {
  if (!(await cookies()).has(TOKEN_COOKIE)) {
    return null;
  }
  try {
    const { data } = await api<{ data: User }>("/auth/me");
    return data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
});

/**
 * Data Access Layer guard. Call inside a Suspense boundary. A missing or expired token goes
 * through /auth/expired, which clears the cookie (not allowed during render) before /login.
 */
export async function requireUser(): Promise<User> {
  const user = await getOptionalUser();
  if (!user) {
    const current = (await headers()).get("x-reenite-path");
    redirect(current ? `/auth/expired?${new URLSearchParams({ next: current })}` : "/auth/expired");
  }
  return user;
}

/** Guard for the customer dashboard: staff are sent to the admin console. */
export async function requireCustomer(): Promise<User> {
  const user = await requireUser();
  if (user.type === "staff") {
    redirect("/admin");
  }
  return user;
}

/** Guard for the admin console: staff only. */
export async function requireStaff(permission?: string): Promise<User> {
  const user = await requireUser();
  if (user.type !== "staff") {
    redirect("/dashboard");
  }
  if (permission && !can(user, permission)) {
    redirect("/admin?denied=1");
  }
  return user;
}

export function can(user: User, permission: string): boolean {
  const permissions = user.permissions ?? [];
  return permissions.includes("*") || permissions.includes(permission);
}

export function homeFor(user: Pick<User, "type">): string {
  return user.type === "staff" ? "/admin" : "/dashboard";
}
