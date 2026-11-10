"use server";

import { refresh } from "next/cache";
import { api, toFormState } from "@/lib/api";
import type { Coupon, FormState } from "@/lib/types";

export type CouponInput = {
  code: string;
  description: string | null;
  discount_type: "percent" | "fixed";
  discount_value: number;
  max_discount: number | null;
  min_spend: number | null;
  applies_to: string;
  max_uses: number | null;
  max_uses_per_customer: number | null;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
};

export async function saveCoupon(id: number | null, input: CouponInput): Promise<FormState & { id?: number }> {
  try {
    const { data } = await api<{ data: Coupon }>(id ? `/admin/finance/coupons/${id}` : "/admin/finance/coupons", { method: id ? "PUT" : "POST", body: input });
    refresh();
    return { ok: true, message: id ? "Coupon saved." : `Coupon ${data.code} created.`, id: data.id };
  } catch (error) {
    return toFormState(error);
  }
}

export async function deleteCoupon(id: number): Promise<FormState> {
  try {
    await api(`/admin/finance/coupons/${id}`, { method: "DELETE" });
  } catch (error) {
    return toFormState(error);
  }
  refresh();
  return { ok: true, message: "Coupon deleted." };
}
