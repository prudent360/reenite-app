"use server";

import { refresh } from "next/cache";
import { api, apiUpload, toFormState } from "@/lib/api";
import type { FormState, Payment } from "@/lib/types";

/**
 * Starts an online payment. The client then sends the browser to `data.redirect_url`
 * (the gateway's own checkout page). The amount is decided by the API, never here.
 */
export async function startPayment(invoiceId: number, gateway: string, saveCard = false): Promise<FormState & { data?: { reference: string; redirect_url: string } }> {
  try {
    const data = await api<{ reference: string; redirect_url: string }>(`/billing/invoices/${invoiceId}/pay`, { method: "POST", body: { gateway, save_card: saveCard } });
    return { ok: true, data };
  } catch (error) {
    return toFormState(error);
  }
}

export async function submitBankTransfer(invoiceId: number, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = { sender_name: String(formData.get("sender_name") ?? ""), transferred_on: String(formData.get("transferred_on") ?? "") };
  const proof = formData.get("proof");
  if (!(proof instanceof File) || proof.size === 0) {
    return { ok: false, errors: { proof: ["Attach a photo or PDF of your transfer receipt."] }, values };
  }

  const form = new FormData();
  form.set("proof", proof, proof.name);
  form.set("sender_name", values.sender_name);
  form.set("transferred_on", values.transferred_on);

  try {
    await apiUpload<{ data: Payment }>(`/billing/invoices/${invoiceId}/bank-transfer`, form);
  } catch (error) {
    return toFormState(error, values);
  }
  refresh();
  return { ok: true, message: "Thanks! We've received your transfer details and will confirm them shortly." };
}

/** Adds a discount code to an unpaid invoice. The API decides the discount. */
export async function applyCoupon(invoiceId: number, code: string): Promise<FormState> {
  try {
    await api(`/billing/invoices/${invoiceId}/coupon`, { method: "POST", body: { code } });
  } catch (error) {
    return toFormState(error);
  }
  refresh();
  return { ok: true, message: "Discount applied." };
}

export async function removeCoupon(invoiceId: number): Promise<FormState> {
  try {
    await api(`/billing/invoices/${invoiceId}/coupon`, { method: "DELETE" });
  } catch (error) {
    return toFormState(error);
  }
  refresh();
  return { ok: true, message: "Discount removed." };
}

/* ---------- Saved cards ---------- */

export async function makeDefaultCard(cardId: number): Promise<FormState> {
  try {
    const { message } = await api<{ message: string }>(`/billing/cards/${cardId}/default`, { method: "POST" });
    refresh();
    return { ok: true, message };
  } catch (error) {
    return toFormState(error);
  }
}

export async function removeCard(cardId: number): Promise<FormState> {
  try {
    await api(`/billing/cards/${cardId}`, { method: "DELETE" });
    refresh();
    return { ok: true, message: "Card removed." };
  } catch (error) {
    return toFormState(error);
  }
}

/* ---------- Renewals ---------- */

export async function setAutoRenew(kind: "passes" | "memberships", id: number, on: boolean): Promise<FormState> {
  try {
    const { message } = await api<{ message: string }>(`/plans/${kind}/${id}/auto-renew`, { method: "PATCH", body: { auto_renew: on } });
    refresh();
    return { ok: true, message };
  } catch (error) {
    return toFormState(error);
  }
}

export async function renewPlan(kind: "passes" | "memberships", id: number): Promise<FormState & { invoiceId?: number }> {
  try {
    const { invoice_id } = await api<{ invoice_id: number }>(`/plans/${kind}/${id}/renew`, { method: "POST" });
    return { ok: true, invoiceId: invoice_id };
  } catch (error) {
    return toFormState(error);
  }
}
