"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { api, apiUpload, toFormState } from "@/lib/api";
import type { FormState, Order } from "@/lib/types";

export async function placeOrder(serviceSlug: string, answers: Record<string, unknown>): Promise<FormState> {
  let order: Order;
  try {
    ({ data: order } = await api<{ data: Order }>("/orders", { method: "POST", body: { service: serviceSlug, answers } }));
  } catch (error) {
    return toFormState(error);
  }
  redirect(`/dashboard/orders/${order.reference}?new=1`);
}

/** Upload for a required document (`requirement_id`) or a file question (`field_key`). */
export async function uploadOrderFile(reference: string, formData: FormData): Promise<FormState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a file to upload." };
  }
  const form = new FormData();
  form.set("file", file, file.name);
  for (const key of ["requirement_id", "field_key"]) {
    const value = formData.get(key);
    if (value) form.set(key, String(value));
  }
  try {
    await apiUpload(`/orders/${reference}/files`, form);
  } catch (error) {
    const state = toFormState(error);
    return { ...state, message: state.message ?? state.errors?.file?.[0] ?? "Upload failed." };
  }
  refresh();
  return { ok: true, message: `${file.name} uploaded.` };
}

export async function sendOrderMessage(reference: string, body: string): Promise<FormState> {
  try {
    await api(`/orders/${reference}/messages`, { method: "POST", body: { body } });
  } catch (error) {
    return toFormState(error);
  }
  refresh();
  return { ok: true };
}

export async function cancelOrder(reference: string): Promise<FormState> {
  try {
    await api(`/orders/${reference}/cancel`, { method: "POST", body: {} });
  } catch (error) {
    return toFormState(error);
  }
  refresh();
  return { ok: true, message: "Order cancelled." };
}
