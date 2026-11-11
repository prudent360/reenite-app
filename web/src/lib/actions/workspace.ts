"use server";

import { refresh, updateTag } from "next/cache";
import { api, apiUpload, toFormState } from "@/lib/api";
import { WORKSPACE_TAG } from "@/lib/booking";
import type { FormState } from "@/lib/types";

/** Admin workspace collections, as named in the API. */
export type WorkspaceKind = "locations" | "space-types" | "spaces" | "addons" | "closures" | "cancellation-policies" | "pass-plans" | "membership-plans";

const labels: Record<WorkspaceKind, string> = {
  locations: "Location",
  "space-types": "Space type",
  spaces: "Space",
  addons: "Add-on",
  closures: "Closure",
  "cancellation-policies": "Cancellation policy",
  "pass-plans": "Pass",
  "membership-plans": "Membership",
};

/** Creates or updates one item. On success `id` is the saved item's id, so new pages can redirect to it. */
export async function saveWorkspaceItem(kind: WorkspaceKind, id: number | null, body: object): Promise<FormState & { id?: number }> {
  let saved: { data: { id: number } };
  try {
    saved = await api<{ data: { id: number } }>(id ? `/admin/workspace/${kind}/${id}` : `/admin/workspace/${kind}`, { method: id ? "PUT" : "POST", body });
  } catch (error) {
    return toFormState(error);
  }
  // Public booking pages read a cached copy of spaces and prices.
  updateTag(WORKSPACE_TAG);
  refresh();
  return { ok: true, message: `${labels[kind]} ${id ? "saved" : "created"}.`, id: saved.data.id };
}

export async function deleteWorkspaceItem(kind: WorkspaceKind, id: number): Promise<FormState> {
  try {
    await api(`/admin/workspace/${kind}/${id}`, { method: "DELETE" });
  } catch (error) {
    return toFormState(error);
  }
  // Public booking pages read a cached copy of spaces and prices.
  updateTag(WORKSPACE_TAG);
  refresh();
  return { ok: true, message: `${labels[kind]} deleted.` };
}

export async function uploadSpacePhoto(spaceId: number, formData: FormData): Promise<FormState> {
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return { ok: false, message: "Choose a photo to upload." };
  }
  const form = new FormData();
  form.set("photo", photo, photo.name);
  try {
    await apiUpload(`/admin/workspace/spaces/${spaceId}/photo`, form);
  } catch (error) {
    const state = toFormState(error);
    return { ...state, message: state.message ?? state.errors?.photo?.[0] ?? "Upload failed." };
  }
  // Public booking pages read a cached copy of spaces and prices.
  updateTag(WORKSPACE_TAG);
  refresh();
  return { ok: true, message: "Photo updated." };
}

export async function removeSpacePhoto(spaceId: number): Promise<FormState> {
  try {
    await api(`/admin/workspace/spaces/${spaceId}/photo`, { method: "DELETE" });
  } catch (error) {
    return toFormState(error);
  }
  // Public booking pages read a cached copy of spaces and prices.
  updateTag(WORKSPACE_TAG);
  refresh();
  return { ok: true, message: "Photo removed." };
}

/* ---------- Seats (hot desks) ---------- */

/** Adds a run of numbered seats, e.g. "Desk" × 10 gives Desk 1 to Desk 10 (or carries on from the last number). */
export async function addSpaceSeats(spaceId: number, input: { prefix: string; count: number; zone: string }): Promise<FormState> {
  try {
    await api(`/admin/workspace/spaces/${spaceId}/seats`, { method: "POST", body: { prefix: input.prefix, count: input.count, zone: input.zone || null } });
  } catch (error) {
    return toFormState(error);
  }
  updateTag(WORKSPACE_TAG);
  refresh();
  return { ok: true, message: input.count === 1 ? "Seat added." : `${input.count} seats added.` };
}

export async function updateSpaceSeat(spaceId: number, seatId: number, body: { label?: string; zone?: string | null; is_active?: boolean }): Promise<FormState> {
  try {
    await api(`/admin/workspace/spaces/${spaceId}/seats/${seatId}`, { method: "PATCH", body });
  } catch (error) {
    return toFormState(error);
  }
  updateTag(WORKSPACE_TAG);
  refresh();
  return { ok: true, message: "Seat saved." };
}

export async function deleteSpaceSeat(spaceId: number, seatId: number): Promise<FormState> {
  try {
    await api(`/admin/workspace/spaces/${spaceId}/seats/${seatId}`, { method: "DELETE" });
  } catch (error) {
    return toFormState(error);
  }
  updateTag(WORKSPACE_TAG);
  refresh();
  return { ok: true, message: "Seat deleted." };
}
