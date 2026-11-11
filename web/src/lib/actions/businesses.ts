"use server";

import { refresh } from "next/cache";
import { api, toFormState } from "@/lib/api";
import type { Business, ComplianceItem, FormState } from "@/lib/types";

async function run(call: () => Promise<{ message?: string } | unknown>, fallback: string): Promise<FormState> {
  let message = fallback;
  try {
    const result = await call();
    if (result && typeof result === "object" && "message" in result && typeof result.message === "string") message = result.message;
  } catch (error) {
    return toFormState(error);
  }
  refresh();
  return { ok: true, message };
}

export type BusinessInput = {
  name: string;
  entity_type: string;
  registration_number: string | null;
  registered_on: string | null;
  tin: string | null;
  vat_registered: boolean;
  has_employees: boolean;
  financial_year_end_month: number;
  state: string | null;
  industry: string | null;
};

export async function saveBusiness(id: number | null, input: BusinessInput): Promise<FormState & { id?: number }> {
  try {
    const result = await api<{ data: Business; message: string }>(id ? `/businesses/${id}` : "/businesses", { method: id ? "PUT" : "POST", body: input });
    refresh();
    return { ok: true, message: result.message, id: result.data.id };
  } catch (error) {
    return toFormState(error);
  }
}

export async function deleteBusiness(id: number): Promise<FormState> {
  return run(() => api(`/businesses/${id}`, { method: "DELETE" }), "Business removed.");
}

/* ---------- Compliance calendar ---------- */

export async function setComplianceStatus(itemId: number, status: ComplianceItem["status"], note?: string | null): Promise<FormState> {
  return run(() => api(`/compliance/items/${itemId}`, { method: "PATCH", body: note === undefined ? { status } : { status, note } }), "Saved.");
}

export async function addReminder(businessId: number, input: { title: string; due_on: string; note: string | null }): Promise<FormState> {
  return run(() => api(`/compliance/businesses/${businessId}/items`, { method: "POST", body: input }), "Reminder added.");
}

export async function deleteReminder(itemId: number): Promise<FormState> {
  return run(() => api(`/compliance/items/${itemId}`, { method: "DELETE" }), "Reminder deleted.");
}

/* ---------- Staff ---------- */

export async function staffSetComplianceStatus(itemId: number, status: ComplianceItem["status"], note: string | null): Promise<FormState> {
  return run(() => api(`/admin/compliance/items/${itemId}`, { method: "PATCH", body: { status, note } }), status === "done" ? "Marked done." : "Saved.");
}
