"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { api, toFormState } from "@/lib/api";
import { CATALOGUE_TAG } from "@/lib/catalogue";
import type { DocumentRequirement, FormField, FormState, Service, ServiceStage } from "@/lib/types";

/** Admin edits change what customers see, so expire the cached public catalogue too. */
function catalogueChanged() {
  updateTag(CATALOGUE_TAG);
  refresh();
}

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

/** Naira typed by the admin ("25,000.50") to whole kobo. Empty means 0; garbage is left for the API to reject. */
function toKobo(value: string): number | string {
  const cleaned = value.replace(/[₦,\s]/g, "");
  if (cleaned === "") {
    return 0;
  }
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? Math.round(amount * 100) : value;
}

/* ---------- Categories ---------- */

export async function saveCategory(categoryId: number | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = {
    name: text(formData, "name"),
    description: text(formData, "description"),
    icon: text(formData, "icon") || "briefcase",
    sort_order: text(formData, "sort_order") || "0",
  };
  const body = { ...values, description: values.description || null, sort_order: Number(values.sort_order), is_active: formData.get("is_active") === "on" };

  try {
    await api(categoryId ? `/admin/service-categories/${categoryId}` : "/admin/service-categories", {
      method: categoryId ? "PUT" : "POST",
      body,
    });
  } catch (error) {
    return toFormState(error, values);
  }
  catalogueChanged();
  return { ok: true, message: categoryId ? "Category updated." : "Category created." };
}

export async function deleteCategory(categoryId: number): Promise<FormState> {
  try {
    await api(`/admin/service-categories/${categoryId}`, { method: "DELETE" });
  } catch (error) {
    return toFormState(error);
  }
  catalogueChanged();
  return { ok: true, message: "Category deleted." };
}

/* ---------- Services ---------- */

function serviceBody(formData: FormData) {
  const values = {
    service_category_id: text(formData, "service_category_id"),
    name: text(formData, "name"),
    slug: text(formData, "slug"),
    summary: text(formData, "summary"),
    description: text(formData, "description"),
    service_fee: text(formData, "service_fee"),
    government_fee: text(formData, "government_fee"),
    turnaround_days: text(formData, "turnaround_days"),
  };
  const body = {
    ...values,
    service_category_id: Number(values.service_category_id) || null,
    slug: values.slug || null,
    description: values.description || null,
    service_fee: toKobo(values.service_fee),
    government_fee: toKobo(values.government_fee),
    turnaround_days: values.turnaround_days ? Number(values.turnaround_days) : null,
    requires_business: formData.get("requires_business") === "on",
    is_active: formData.get("is_active") === "on",
  };
  return { values, body };
}

export async function createService(_prev: FormState, formData: FormData): Promise<FormState> {
  const { values, body } = serviceBody(formData);
  let service: Service;
  try {
    ({ data: service } = await api<{ data: Service }>("/admin/services", { method: "POST", body }));
  } catch (error) {
    return toFormState(error, values);
  }
  updateTag(CATALOGUE_TAG);
  redirect(`/admin/services/${service.id}?tab=form&created=1`);
}

export async function updateService(serviceId: number, _prev: FormState, formData: FormData): Promise<FormState> {
  const { values, body } = serviceBody(formData);
  try {
    await api(`/admin/services/${serviceId}`, { method: "PUT", body });
  } catch (error) {
    return toFormState(error, values);
  }
  catalogueChanged();
  return { ok: true, message: "Service details saved.", values };
}

export async function archiveService(serviceId: number): Promise<FormState> {
  try {
    await api(`/admin/services/${serviceId}`, { method: "DELETE" });
  } catch (error) {
    return toFormState(error);
  }
  updateTag(CATALOGUE_TAG);
  redirect("/admin/services?archived=1");
}

/* ---------- Builder (fields, documents, stages) ---------- */

/** Builder saves return the saved service so new rows pick up their database ids. */
export type BuilderResult = FormState & { service?: Service };

async function saveBuilderList(serviceId: number, part: "fields" | "requirements" | "stages", body: object, message: string): Promise<BuilderResult> {
  let service: Service;
  try {
    ({ data: service } = await api<{ data: Service }>(`/admin/services/${serviceId}/${part}`, { method: "PUT", body }));
  } catch (error) {
    return toFormState(error);
  }
  catalogueChanged();
  return { ok: true, message, service };
}

export async function saveFormFields(serviceId: number, fields: FormField[]): Promise<BuilderResult> {
  return saveBuilderList(serviceId, "fields", { fields }, "Intake form saved.");
}

export async function saveRequirements(serviceId: number, requirements: DocumentRequirement[]): Promise<BuilderResult> {
  return saveBuilderList(serviceId, "requirements", { requirements }, "Required documents saved.");
}

export async function saveStages(serviceId: number, stages: ServiceStage[]): Promise<BuilderResult> {
  return saveBuilderList(serviceId, "stages", { stages }, "Stages saved.");
}

/* ---------- Bundles ---------- */

export async function saveBundle(
  bundleId: number | null,
  input: { name: string; summary: string; description: string; price: string; is_active: boolean; service_ids: number[] },
): Promise<FormState> {
  try {
    await api(bundleId ? `/admin/bundles/${bundleId}` : "/admin/bundles", {
      method: bundleId ? "PUT" : "POST",
      body: { ...input, description: input.description || null, price: toKobo(input.price) },
    });
  } catch (error) {
    return toFormState(error);
  }
  catalogueChanged();
  return { ok: true, message: bundleId ? "Bundle updated." : "Bundle created." };
}

export async function deleteBundle(bundleId: number): Promise<FormState> {
  try {
    await api(`/admin/bundles/${bundleId}`, { method: "DELETE" });
  } catch (error) {
    return toFormState(error);
  }
  catalogueChanged();
  return { ok: true, message: "Bundle deleted." };
}
