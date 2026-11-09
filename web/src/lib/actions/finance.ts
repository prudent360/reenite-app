"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { api, toFormState } from "@/lib/api";
import type { FormState, Invoice } from "@/lib/types";

async function run(call: () => Promise<unknown>, message: string): Promise<FormState> {
  try {
    await call();
  } catch (error) {
    return toFormState(error);
  }
  refresh();
  return { ok: true, message };
}

export async function approveTransfer(reference: string, note: string) {
  return run(() => api(`/admin/finance/payments/${reference}/approve`, { method: "POST", body: { note: note || null } }), "Transfer approved. The customer has been sent a receipt.");
}

export async function rejectTransfer(reference: string, reason: string) {
  return run(() => api(`/admin/finance/payments/${reference}/reject`, { method: "POST", body: { reason } }), "Transfer rejected. The customer has been emailed the reason.");
}

/** `amount` is in naira as typed; the API takes kobo. */
export async function refundPayment(reference: string, input: { amount: string; reason: string; method: "gateway" | "manual" }) {
  const kobo = Math.round(Number(input.amount.replace(/[₦,\s]/g, "")) * 100);
  return run(
    () => api(`/admin/finance/payments/${reference}/refunds`, { method: "POST", body: { amount: Number.isFinite(kobo) ? kobo : 0, reason: input.reason, method: input.method } }),
    "Refund recorded.",
  );
}

export async function createInvoice(input: {
  customer_id: number | null;
  items: { description: string; quantity: number; unit_amount: string; service_id: number | null }[];
  due_at: string;
  notes: string;
  notify: boolean;
}): Promise<FormState> {
  let invoice: Invoice;
  try {
    ({ data: invoice } = await api<{ data: Invoice }>("/admin/finance/invoices", {
      method: "POST",
      body: {
        ...input,
        due_at: input.due_at || null,
        notes: input.notes || null,
        items: input.items.map((item) => ({ ...item, unit_amount: Math.round(Number(item.unit_amount.replace(/[₦,\s]/g, "")) * 100) || 0 })),
      },
    }));
  } catch (error) {
    return toFormState(error);
  }
  redirect(`/admin/finance/invoices/${invoice.id}?created=1`);
}

export async function voidInvoice(invoiceId: number) {
  return run(() => api(`/admin/finance/invoices/${invoiceId}/void`, { method: "POST" }), "Invoice cancelled.");
}

/** Customer lookup for the invoice form. */
export async function searchCustomers(query: string): Promise<{ id: number; name: string; email: string }[]> {
  if (query.trim().length < 2) {
    return [];
  }
  try {
    const { data } = await api<{ data: { id: number; name: string; email: string }[] }>(
      `/admin/customers?${new URLSearchParams({ search: query.trim(), per_page: "8" })}`,
    );
    return data.map(({ id, name, email }) => ({ id, name, email }));
  } catch {
    return [];
  }
}
