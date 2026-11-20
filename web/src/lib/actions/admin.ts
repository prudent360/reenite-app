"use server";

import { refresh } from "next/cache";
import { api, apiUpload, toFormState } from "@/lib/api";
import type { CustomerImportRow, CustomerImportSummary, FormState } from "@/lib/types";

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

/** A fresh invite link for someone who hasn't signed in yet; the old link stops working. */
export async function resendStaffInvite(userId: number): Promise<FormState> {
  try {
    const { message } = await api<{ message: string }>(`/admin/staff/${userId}/invite`, { method: "POST" });
    return { ok: true, message };
  } catch (error) {
    return toFormState(error);
  }
}

/** Removes an invite nobody accepted, so it can be sent again to the right person or email. */
export async function removeStaffInvite(userId: number): Promise<FormState> {
  try {
    await api(`/admin/staff/${userId}`, { method: "DELETE" });
  } catch (error) {
    return toFormState(error);
  }
  refresh();
  return { ok: true, message: "Invite removed." };
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

type BulkResult = FormState & { count?: number };

/** Suspends or reactivates several customers at once. */
export async function setCustomersStatus(ids: number[], status: "active" | "suspended"): Promise<BulkResult> {
  try {
    const result = await api<{ updated: number; message: string }>("/admin/customers/bulk/status", { method: "POST", body: { ids, status } });
    refresh();
    return { ok: true, message: result.message, count: result.updated };
  } catch (error) {
    return toFormState(error);
  }
}

/** Deletes customers with no history; anyone with bookings, orders or payments is kept. */
export async function deleteCustomers(ids: number[]): Promise<BulkResult> {
  try {
    const result = await api<{ deleted: number; message: string }>("/admin/customers/bulk/delete", { method: "POST", body: { ids } });
    refresh();
    return { ok: true, message: result.message, count: result.deleted };
  } catch (error) {
    return toFormState(error);
  }
}

export async function messageCustomers(ids: number[], input: { subject: string; message: string; channels: ("email" | "whatsapp")[] }): Promise<BulkResult> {
  try {
    const result = await api<{ recipients: number; message: string }>("/admin/customers/bulk/message", { method: "POST", body: { ids, ...input } });
    return { ok: true, message: result.message, count: result.recipients };
  } catch (error) {
    return toFormState(error);
  }
}

export type CustomerImportState = FormState & { summary?: CustomerImportSummary; rows?: CustomerImportRow[]; imported?: number };

/**
 * Checks a customers CSV (`preview`) or imports it. The file is sent again for the import, so
 * nothing is kept on the server between the two steps.
 */
export async function importCustomers(file: File, options: { preview: true } | { preview: false; temporaryPassword: string; sendEmail: boolean }): Promise<CustomerImportState> {
  const form = new FormData();
  form.set("file", file, file.name);
  form.set("preview", options.preview ? "1" : "0");
  if (!options.preview) {
    form.set("temporary_password", options.temporaryPassword);
    form.set("send_email", options.sendEmail ? "1" : "0");
  }

  try {
    const result = await apiUpload<{ summary: CustomerImportSummary; rows?: CustomerImportRow[]; imported?: number; message?: string }>("/admin/customers/import", form);
    if (!options.preview) refresh();
    return { ok: true, ...result };
  } catch (error) {
    return toFormState(error);
  }
}
