"use server";

import { redirect } from "next/navigation";
import { api, toFormState } from "@/lib/api";
import { clearSessionToken, homeFor, setSessionToken } from "@/lib/session";
import type { FormState, User } from "@/lib/types";

type TokenResponse = { token: string; user: User };

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

/** Only allow same-site relative redirects after login. */
function safeNext(value: string, fallback: string): string {
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = { email: field(formData, "email") };
  let result: TokenResponse;

  try {
    result = await api<TokenResponse>("/auth/login", {
      method: "POST",
      anonymous: true,
      body: { ...values, password: String(formData.get("password") ?? ""), device_name: "web" },
    });
  } catch (error) {
    return toFormState(error, values);
  }

  await setSessionToken(result.token);
  const home = homeFor(result.user);
  const next = safeNext(field(formData, "next"), home);
  // Customers can't use admin links and staff don't use the customer dashboard.
  const crossesArea = /^\/(admin|dashboard)/.test(next) && !next.startsWith(home);
  redirect(crossesArea ? home : next);
}

export async function register(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = {
    name: field(formData, "name"),
    email: field(formData, "email").toLowerCase(),
    phone: field(formData, "phone"),
  };

  let result: TokenResponse;
  try {
    result = await api<TokenResponse>("/auth/register", {
      method: "POST",
      anonymous: true,
      body: {
        ...values,
        phone: values.phone || null,
        password: String(formData.get("password") ?? ""),
        password_confirmation: String(formData.get("password_confirmation") ?? ""),
        device_name: "web",
      },
    });
  } catch (error) {
    return toFormState(error, values);
  }

  await setSessionToken(result.token);
  redirect("/dashboard?welcome=1");
}

/**
 * Revokes the token and clears the cookie. The caller does a full page load afterwards,
 * because Next keeps visited pages mounted (hidden) and the old account's data must not linger.
 */
export async function logout(): Promise<void> {
  try {
    await api("/auth/logout", { method: "POST" });
  } catch {
    // The token may already be expired; clearing the cookie is what matters.
  }
  await clearSessionToken();
}

export async function forgotPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = { email: field(formData, "email") };
  try {
    const { message } = await api<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      anonymous: true,
      body: values,
    });
    return { ok: true, message, values };
  } catch (error) {
    return toFormState(error, values);
  }
}

export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = { email: field(formData, "email"), token: field(formData, "token") };
  try {
    const { message } = await api<{ message: string }>("/auth/reset-password", {
      method: "POST",
      anonymous: true,
      body: {
        ...values,
        password: String(formData.get("password") ?? ""),
        password_confirmation: String(formData.get("password_confirmation") ?? ""),
      },
    });
    return { ok: true, message, values };
  } catch (error) {
    return toFormState(error, values);
  }
}

export async function resendVerification(): Promise<FormState> {
  try {
    const { message } = await api<{ message: string }>("/auth/email/resend", { method: "POST" });
    return { ok: true, message };
  } catch (error) {
    return toFormState(error);
  }
}
