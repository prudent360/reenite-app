"use server";

import { refresh } from "next/cache";
import { api, toFormState } from "@/lib/api";
import type { EmailTemplate, FormState, PaymentGateway } from "@/lib/types";

type Result<T = undefined> = FormState & { data?: T };

/** Runs an admin settings call and converts failures into form state. */
async function run<T>(call: () => Promise<T>, message?: string | ((data: T) => string)): Promise<Result<T>> {
  let data: T;
  try {
    data = await call();
  } catch (error) {
    return toFormState(error);
  }
  refresh();
  return { ok: true, data, message: typeof message === "function" ? message(data) : message };
}

/* ---------- Payment gateways ---------- */

export async function saveGateway(
  code: string,
  input: { is_enabled: boolean; mode: "test" | "live"; credentials: Record<string, Record<string, string>> },
) {
  return run(() => api<{ data: PaymentGateway }>(`/admin/settings/payments/gateways/${code}`, { method: "PUT", body: input }), "Gateway settings saved.");
}

export async function testGateway(code: string) {
  return run(
    () => api<{ message: string }>(`/admin/settings/payments/gateways/${code}/test`, { method: "POST" }),
    (data) => data.message,
  );
}

/* ---------- Bank transfer ---------- */

export async function saveBankTransfer(input: { enabled: boolean; instructions: string }) {
  return run(() => api("/admin/settings/payments/bank-transfer", { method: "PUT", body: { ...input, instructions: input.instructions || null } }), "Bank transfer settings saved.");
}

export async function saveBankAccount(id: number | null, input: { bank_name: string; account_name: string; account_number: string; is_active: boolean }) {
  return run(
    () => api(id ? `/admin/settings/bank-accounts/${id}` : "/admin/settings/bank-accounts", { method: id ? "PUT" : "POST", body: input }),
    id ? "Account updated." : "Account added.",
  );
}

export async function deleteBankAccount(id: number) {
  return run(() => api(`/admin/settings/bank-accounts/${id}`, { method: "DELETE" }), "Account removed.");
}

/* ---------- Email delivery ---------- */

export async function saveMailSettings(input: Record<string, string | number | boolean | null>) {
  return run(() => api<{ message: string }>("/admin/settings/mail", { method: "PUT", body: input }), (data) => data.message);
}

export async function sendTestEmail(to: string) {
  return run(
    () => api<{ message: string; delivered: boolean }>("/admin/settings/mail/test", { method: "POST", body: { to } }),
    (data) => data.message,
  );
}

/* ---------- Email templates ---------- */

type TemplateInput = Pick<EmailTemplate, "subject" | "heading" | "body" | "button_text" | "footer" | "is_enabled">;

export async function saveEmailTemplate(key: string, input: TemplateInput) {
  return run(() => api<{ data: EmailTemplate }>(`/admin/settings/email-templates/${key}`, { method: "PUT", body: input }), "Template saved.");
}

export async function resetEmailTemplate(key: string) {
  return run(() => api<{ data: EmailTemplate }>(`/admin/settings/email-templates/${key}/reset`, { method: "POST" }), "Template reset to the default wording.");
}

/** Renders unsaved edits on the server; doesn't change anything, so no refresh. */
export async function previewEmailTemplate(key: string, input: TemplateInput): Promise<Result<{ subject: string; html: string }>> {
  try {
    return { ok: true, data: await api<{ subject: string; html: string }>(`/admin/settings/email-templates/${key}/preview`, { method: "POST", body: input }) };
  } catch (error) {
    return toFormState(error);
  }
}

export async function sendTemplateTest(key: string) {
  return run(() => api<{ message: string }>(`/admin/settings/email-templates/${key}/test`, { method: "POST" }), (data) => data.message);
}

/* ---------- WhatsApp ---------- */

export async function saveWhatsAppSettings(input: { enabled: boolean; phone_number_id: string | null; access_token: string | null; language: string; templates: Record<string, string> }) {
  return run(() => api<{ message: string }>("/admin/settings/whatsapp", { method: "PUT", body: input }), (data) => data.message);
}

export async function sendWhatsAppTest(to: string, event: string | null) {
  return run(
    () => api<{ message: string }>("/admin/settings/whatsapp/test", { method: "POST", body: { to, event } }),
    (data) => data.message,
  );
}
