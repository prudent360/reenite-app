"use server";

import { refresh, updateTag } from "next/cache";
import { api, apiUpload, toFormState } from "@/lib/api";
import { BLOG_TAG } from "@/lib/blog";
import type { BlogPost, FormState } from "@/lib/types";

type Result<T> = FormState & { data?: T };

export type PostInput = {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  cover_alt: string;
  category: string;
  meta_description: string;
  author_name: string;
  /** ISO time, or null for a draft. */
  published_at: string | null;
};

/** Creates a post (no id) or saves one. Empty text fields are saved as blank. */
export async function savePost(id: number | null, input: PostInput): Promise<Result<BlogPost>> {
  const body = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, typeof value === "string" ? value.trim() || null : value]));
  try {
    const result = await api<{ data: BlogPost; message: string }>(id ? `/admin/blog/${id}` : "/admin/blog", { method: id ? "PUT" : "POST", body });
    // The public blog reads a cached copy.
    updateTag(BLOG_TAG);
    refresh();
    return { ok: true, data: result.data, message: result.message };
  } catch (error) {
    return toFormState(error);
  }
}

export async function deletePost(id: number): Promise<FormState> {
  try {
    await api(`/admin/blog/${id}`, { method: "DELETE" });
  } catch (error) {
    return toFormState(error);
  }
  updateTag(BLOG_TAG);
  return { ok: true, message: "Post deleted." };
}

export async function uploadPostCover(id: number, formData: FormData): Promise<Result<BlogPost>> {
  const cover = formData.get("cover");
  if (!(cover instanceof File) || cover.size === 0) {
    return { ok: false, message: "Choose a photo to upload." };
  }
  const form = new FormData();
  form.set("cover", cover, cover.name);
  try {
    const result = await apiUpload<{ data: BlogPost; message: string }>(`/admin/blog/${id}/cover`, form);
    updateTag(BLOG_TAG);
    refresh();
    return { ok: true, data: result.data, message: result.message };
  } catch (error) {
    const state = toFormState(error);
    return { ...state, message: state.errors?.cover?.[0] ?? state.message ?? "Upload failed." };
  }
}

export async function removePostCover(id: number): Promise<Result<BlogPost>> {
  try {
    const result = await api<{ data: BlogPost; message: string }>(`/admin/blog/${id}/cover`, { method: "DELETE" });
    updateTag(BLOG_TAG);
    refresh();
    return { ok: true, data: result.data, message: result.message };
  } catch (error) {
    return toFormState(error);
  }
}

/** An image for inside a post; returns its address to put in the Markdown. */
export async function uploadPostImage(formData: FormData): Promise<FormState & { url?: string }> {
  const image = formData.get("image");
  if (!(image instanceof File) || image.size === 0) {
    return { ok: false, message: "Choose an image to upload." };
  }
  const form = new FormData();
  form.set("image", image, image.name);
  try {
    const { url } = await apiUpload<{ url: string }>("/admin/blog/images", form);
    return { ok: true, url };
  } catch (error) {
    const state = toFormState(error);
    return { ...state, message: state.errors?.image?.[0] ?? state.message ?? "Upload failed." };
  }
}

/** The post body as the website will show it. */
export async function previewPost(body: string): Promise<string> {
  try {
    return (await api<{ html: string }>("/admin/blog/preview", { method: "POST", body: { body } })).html;
  } catch {
    return "<p>The preview couldn't load. Check your connection and try again.</p>";
  }
}
