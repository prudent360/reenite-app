"use server";

import { refresh } from "next/cache";
import { api, apiUpload, toFormState } from "@/lib/api";
import type { FormState, Payment } from "@/lib/types";

/**
 * Starts an online payment. The client then sends the browser to `data.redirect_url`
 * (the gateway's own checkout page). The amount is decided by the API, never here.
 */
export async function startPayment(invoiceId: number, gateway: string): Promise<FormState & { data?: { reference: string; redirect_url: string } }> {
  try {
    const data = await api<{ reference: string; redirect_url: string }>(`/billing/invoices/${invoiceId}/pay`, { method: "POST", body: { gateway } });
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
