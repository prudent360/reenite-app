"use server";

import { refresh } from "next/cache";
import { api, toFormState } from "@/lib/api";
import type { Consultation, ConsultationType, FormState } from "@/lib/types";

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

export async function consultationSlots(slug: string, date: string): Promise<{ starts_at: string; label: string }[]> {
  try {
    const { data } = await api<{ data: { starts_at: string; label: string }[] }>(`/consultations/types/${slug}/slots?${new URLSearchParams({ date })}`, { anonymous: true });
    return data;
  } catch {
    return [];
  }
}

export async function bookConsultation(input: { consultation_type_id: number; starts_at: string; topic: string }): Promise<FormState & { reference?: string }> {
  try {
    const { data, message } = await api<{ data: Consultation; message: string }>("/consultations", { method: "POST", body: input });
    return { ok: true, message, reference: data.reference };
  } catch (error) {
    return toFormState(error);
  }
}

export async function cancelConsultation(reference: string, reason: string): Promise<FormState> {
  return run(() => api(`/consultations/${reference}/cancel`, { method: "POST", body: { reason: reason || null } }), "Consultation cancelled.");
}

/* ---------- Staff ---------- */

export async function updateConsultation(reference: string, input: { assigned_to?: number | null; meeting_details?: string | null; staff_notes?: string | null }): Promise<FormState> {
  return run(() => api(`/admin/consultations/${reference}`, { method: "PATCH", body: input }), "Saved.");
}

export async function recordConsultationOutcome(reference: string, outcome: "completed" | "no_show"): Promise<FormState> {
  return run(() => api(`/admin/consultations/${reference}/outcome`, { method: "POST", body: { outcome } }), outcome === "completed" ? "Marked as done." : "Marked as missed.");
}

export async function staffCancelConsultation(reference: string, reason: string, refundPercent: number): Promise<FormState> {
  return run(
    () => api(`/admin/consultations/${reference}/cancel`, { method: "POST", body: { reason, refund_percent: refundPercent } }),
    "Consultation cancelled. The customer has been emailed.",
  );
}

export type ConsultationTypeInput = Pick<ConsultationType, "name" | "description" | "duration_minutes" | "price" | "mode" | "schedule" | "notice_hours" | "is_active" | "sort_order">;

export async function saveConsultationType(slug: string | null, input: ConsultationTypeInput): Promise<FormState> {
  return run(
    () => api(slug ? `/admin/consultations/types/${slug}` : "/admin/consultations/types", { method: slug ? "PUT" : "POST", body: input }),
    slug ? "Saved. Existing bookings keep their time and price." : "Consultation added.",
  );
}

export async function deleteConsultationType(slug: string): Promise<FormState> {
  return run(() => api(`/admin/consultations/types/${slug}`, { method: "DELETE" }), "Consultation deleted.");
}
