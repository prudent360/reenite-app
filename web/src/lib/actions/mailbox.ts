"use server";

import { refresh } from "next/cache";
import { api, apiUpload, toFormState } from "@/lib/api";
import type { CustomerOption, FormState, MailAction, MailOutcome, Mailbox } from "@/lib/types";
import { uploadTooLarge } from "@/lib/uploads";

async function run(call: () => Promise<unknown>, message: string): Promise<FormState> {
  try {
    await call();
  } catch (error) {
    return toFormState(error);
  }
  refresh();
  return { ok: true, message };
}

/* ---------- Customer ---------- */

const requestMessages: Record<MailAction, string> = {
  collect: "We'll keep it at the front desk for you to collect.",
  forward: "We'll forward it and let you know when it's sent.",
  scan: "We'll scan it and email you when it's ready.",
  shred: "We'll shred it securely.",
};

export async function requestMail(itemId: number, action: MailAction, note: string): Promise<FormState> {
  return run(() => api(`/mailbox/items/${itemId}/request`, { method: "POST", body: { action, note: note || null } }), requestMessages[action]);
}

export async function cancelMailRequest(itemId: number): Promise<FormState> {
  return run(() => api(`/mailbox/items/${itemId}/request`, { method: "DELETE" }), "Request cancelled.");
}

/* ---------- Front desk ---------- */

export async function searchMailCustomers(search: string): Promise<CustomerOption[]> {
  try {
    const { data } = await api<{ data: CustomerOption[] }>(`/admin/mail/customers?${new URLSearchParams({ search })}`);
    return data;
  } catch {
    return [];
  }
}

export async function openMailbox(input: { user_id: number | null; location_id: number | null; business_name: string; active_until: string | null; notes: string | null }): Promise<FormState & { id?: number }> {
  try {
    const { data } = await api<{ data: Mailbox }>("/admin/mail/mailboxes", { method: "POST", body: input });
    return { ok: true, message: `Mailbox ${data.number} opened.`, id: data.id };
  } catch (error) {
    return toFormState(error);
  }
}

export async function updateMailbox(id: number, input: { business_name: string; status: "active" | "closed"; active_until: string | null; notes: string | null }): Promise<FormState> {
  return run(() => api(`/admin/mail/mailboxes/${id}`, { method: "PUT", body: input }), "Mailbox saved.");
}

export async function logMail(mailboxId: number, formData: FormData): Promise<FormState> {
  const form = new FormData();
  for (const key of ["kind", "sender", "description", "received_at"]) {
    const value = String(formData.get(key) ?? "").trim();
    if (value) form.set(key, value);
  }
  const scan = formData.get("scan");
  if (scan instanceof File && scan.size > 0) {
    const tooLarge = uploadTooLarge(scan, "The scan");
    if (tooLarge) return { ok: false, errors: { scan: [tooLarge] } };
    form.set("scan", scan, scan.name);
  }
  return run(() => apiUpload(`/admin/mail/mailboxes/${mailboxId}/items`, form), "Mail logged. The customer has been emailed.");
}

export async function uploadMailScan(itemId: number, formData: FormData): Promise<FormState> {
  const scan = formData.get("scan");
  if (!(scan instanceof File) || scan.size === 0) return { ok: false, message: "Choose the scan to upload." };
  const tooLarge = uploadTooLarge(scan, "The scan");
  if (tooLarge) return { ok: false, message: tooLarge };
  const form = new FormData();
  form.set("scan", scan, scan.name);
  return run(() => apiUpload(`/admin/mail/items/${itemId}/scan`, form), "Scan added. The customer has been emailed.");
}

export async function handleMail(itemId: number, outcome: MailOutcome, note: string): Promise<FormState> {
  return run(() => api(`/admin/mail/items/${itemId}/handle`, { method: "POST", body: { outcome, note: note || null } }), "Done. The item is off the front desk list.");
}
