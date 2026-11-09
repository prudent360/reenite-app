"use server";

import { refresh } from "next/cache";
import { api, apiUpload, toFormState } from "@/lib/api";
import type { FormState } from "@/lib/types";

async function act(reference: string, path: string, body: object, message: string): Promise<FormState> {
  try {
    await api(`/admin/orders/${reference}/${path}`, { method: "POST", body });
  } catch (error) {
    return toFormState(error);
  }
  refresh();
  return { ok: true, message };
}

export async function assignOrder(reference: string, userId: number | null) {
  return act(reference, "assign", { user_id: userId }, userId ? "Order assigned." : "Order unassigned.");
}

export async function startOrder(reference: string) {
  return act(reference, "start", {}, "Work started. The customer can see this.");
}

export async function setOrderStage(reference: string, index: number) {
  return act(reference, "stage", { index }, "Stage updated.");
}

export async function requestOrderInfo(reference: string, message: string) {
  return act(reference, "request-info", { message }, "Request sent. The order is paused until the customer responds.");
}

export async function completeOrder(reference: string, note: string) {
  return act(reference, "complete", { note: note || null }, "Order completed. The customer has been emailed.");
}

export async function cancelAdminOrder(reference: string, reason: string) {
  return act(reference, "cancel", { reason }, "Order cancelled.");
}

export async function reviewOrderFile(reference: string, fileId: number, status: "accepted" | "rejected", note: string) {
  return act(reference, `files/${fileId}/review`, { status, note: note || null }, status === "accepted" ? "Document accepted." : "Document rejected. The customer can upload a new one.");
}

export async function postOrderMessage(reference: string, body: string, internal: boolean) {
  return act(reference, "messages", { body, internal }, internal ? "Note added." : "Message sent to the customer.");
}

export async function uploadDeliverable(reference: string, formData: FormData): Promise<FormState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a file to upload." };
  }
  const form = new FormData();
  form.set("file", file, file.name);
  try {
    await apiUpload(`/admin/orders/${reference}/files`, form);
  } catch (error) {
    const state = toFormState(error);
    return { ...state, message: state.message ?? state.errors?.file?.[0] ?? "Upload failed." };
  }
  refresh();
  return { ok: true, message: `${file.name} is now available to the customer.` };
}
