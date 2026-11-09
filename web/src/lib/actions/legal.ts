"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { api, apiUpload, toFormState } from "@/lib/api";
import type { Agreement, CustomerOption, FormState, LegalAudience, LegalDocument, Signatory } from "@/lib/types";

type Result<T> = FormState & { data?: T };

/* ---------- Admin: signatory ---------- */

export async function saveSignatory(input: { name: string; title: string; signature: string | null }): Promise<Result<Signatory>> {
  try {
    const result = await api<{ data: Signatory; message: string }>("/admin/settings/signatory", {
      method: "PUT",
      body: { name: input.name, title: input.title || null, ...(input.signature ? { signature: input.signature } : {}) },
    });
    refresh();
    return { ok: true, data: result.data, message: result.message };
  } catch (error) {
    return toFormState(error);
  }
}

/* ---------- Admin: documents ---------- */

export async function searchCustomers(search: string): Promise<CustomerOption[]> {
  try {
    const { data } = await api<{ data: CustomerOption[] }>(`/admin/legal-documents/customers?search=${encodeURIComponent(search)}`);
    return data;
  } catch {
    return [];
  }
}

/** Uploads the PDF (multipart) with who should sign it. */
export async function uploadLegalDocument(form: FormData): Promise<Result<LegalDocument>> {
  try {
    const result = await apiUpload<{ data: LegalDocument; message: string }>("/admin/legal-documents", form);
    refresh();
    return { ok: true, data: result.data, message: result.message };
  } catch (error) {
    return toFormState(error);
  }
}

export async function updateLegalDocument(
  id: number,
  input: { title: string; description: string; audience: LegalAudience; user_ids: number[]; is_active: boolean },
): Promise<Result<LegalDocument>> {
  try {
    const result = await api<{ data: LegalDocument; message: string }>(`/admin/legal-documents/${id}`, { method: "PUT", body: input });
    refresh();
    return { ok: true, data: result.data, message: result.message };
  } catch (error) {
    return toFormState(error);
  }
}

export async function deleteLegalDocument(id: number): Promise<FormState> {
  try {
    await api(`/admin/legal-documents/${id}`, { method: "DELETE" });
    return { ok: true, message: "Document deleted." };
  } catch (error) {
    return toFormState(error);
  }
}

/* ---------- Customer: signing ---------- */

export async function signAgreement(id: number, input: { name: string; signature: string; agree: boolean }): Promise<Result<Agreement>> {
  try {
    // The signer's IP goes on the audit trail, so pass it on rather than this server's.
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim();
    const result = await api<{ data: Agreement; message: string }>(`/agreements/${id}/sign`, {
      method: "POST",
      body: input,
      headers: ip ? { "X-Forwarded-For": ip } : undefined,
    });
    refresh();
    return { ok: true, data: result.data, message: result.message };
  } catch (error) {
    return toFormState(error);
  }
}
