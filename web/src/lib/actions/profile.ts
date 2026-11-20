"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { api, toFormState } from "@/lib/api";
import { homeFor } from "@/lib/session";
import type { FormState, User } from "@/lib/types";

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = {
    name: String(formData.get("name") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
  };
  // Customers' form carries the WhatsApp switch; staff's doesn't, so leave their choice alone.
  const whatsapp = formData.has("whatsapp_field") ? { whatsapp_updates: formData.get("whatsapp_updates") === "on" } : {};
  try {
    await api("/profile", { method: "PUT", body: { ...values, phone: values.phone || null, ...whatsapp } });
  } catch (error) {
    return toFormState(error, values);
  }
  refresh();
  return { ok: true, message: "Profile updated.", values };
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const { message } = await api<{ message: string }>("/profile/password", {
      method: "PUT",
      body: {
        current_password: String(formData.get("current_password") ?? ""),
        password: String(formData.get("password") ?? ""),
        password_confirmation: String(formData.get("password_confirmation") ?? ""),
      },
    });
    return { ok: true, message };
  } catch (error) {
    return toFormState(error);
  }
}

/** First sign-in after an import: replaces the temporary password, then opens their home page. */
export async function chooseOwnPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  let user: User;
  try {
    ({ user } = await api<{ message: string; user: User }>("/profile/temporary-password", {
      method: "PUT",
      body: {
        password: String(formData.get("password") ?? ""),
        password_confirmation: String(formData.get("password_confirmation") ?? ""),
      },
    }));
  } catch (error) {
    return toFormState(error);
  }
  redirect(homeFor(user));
}
