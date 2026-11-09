"use server";

import { refresh } from "next/cache";
import { api, toFormState } from "@/lib/api";
import type { FormState } from "@/lib/types";

export async function inviteStaff(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = {
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    phone: String(formData.get("phone") ?? "").trim(),
    role: String(formData.get("role") ?? ""),
  };
  try {
    await api("/admin/staff", { method: "POST", body: { ...values, phone: values.phone || null } });
  } catch (error) {
    return toFormState(error, values);
  }
  refresh();
  return { ok: true, message: `Invite sent to ${values.email}.` };
}

export async function updateStaff(userId: number, changes: { role?: string; status?: string }): Promise<FormState> {
  try {
    await api(`/admin/staff/${userId}`, { method: "PATCH", body: changes });
  } catch (error) {
    return toFormState(error);
  }
  refresh();
  return { ok: true, message: "Staff member updated." };
}

export async function setCustomerStatus(userId: number, status: "active" | "suspended"): Promise<FormState> {
  try {
    await api(`/admin/customers/${userId}/status`, { method: "PATCH", body: { status } });
  } catch (error) {
    return toFormState(error);
  }
  refresh();
  return { ok: true, message: status === "suspended" ? "Customer suspended." : "Customer reactivated." };
}
