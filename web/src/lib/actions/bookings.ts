"use server";

import { refresh, updateTag } from "next/cache";
import { api, apiUpload, toFormState } from "@/lib/api";
import { BOOKING_SETTINGS_TAG } from "@/lib/booking";
import type { Booking, BookingQuote, BookingSettings, DayAvailability, FormState, Payment, SeatMap, Space } from "@/lib/types";

export type BookingInput = {
  space: string;
  date: string;
  start_time: string | null;
  rate_unit: string;
  quantity: number;
  seats: number;
  /** Chosen seats on a hot desk with named seats; empty means "any free seat". */
  seat_ids?: number[];
  addons: { id: number; quantity: number }[];
  use_pass: boolean;
};

type Result<T> = FormState & { data?: T };

/* ---------- Booking a space ---------- */

/** A space with everything the Time step needs: rates, extras and its cancellation policy. */
export async function getSpace(slug: string): Promise<Result<Space>> {
  try {
    const { data } = await api<{ data: Space }>(`/workspace/spaces/${encodeURIComponent(slug)}`, { anonymous: true });
    return { ok: true, data };
  } catch (error) {
    return toFormState(error);
  }
}

export async function getAvailability(space: string, date: string, seats: number): Promise<Result<DayAvailability>> {
  try {
    const { data } = await api<{ data: DayAvailability }>(`/workspace/spaces/${encodeURIComponent(space)}/availability?${new URLSearchParams({ date, seats: String(seats) })}`);
    return { ok: true, data };
  } catch (error) {
    return toFormState(error);
  }
}

/** Which seats are free for the chosen time (hot desks with named seats). */
export async function getSeatMap(space: string, window: { date: string; start_time: string | null; rate_unit: string; quantity: number }): Promise<Result<SeatMap>> {
  try {
    const query = new URLSearchParams({ date: window.date, rate_unit: window.rate_unit, quantity: String(window.quantity), ...(window.start_time ? { start_time: window.start_time } : {}) });
    const { data } = await api<{ data: SeatMap }>(`/workspace/spaces/${encodeURIComponent(space)}/seats?${query}`);
    return { ok: true, data };
  } catch (error) {
    return toFormState(error);
  }
}

/** Prices the booking. Signed-in customers see their membership discount and pass. */
export async function getQuote(input: BookingInput): Promise<Result<BookingQuote>> {
  try {
    const { data } = await api<{ data: BookingQuote }>("/bookings/quote", { method: "POST", body: input });
    return { ok: true, data };
  } catch (error) {
    return toFormState(error);
  }
}

/** Holds the slot. Returns the booking and its private token, which the booking page needs for guests. */
export async function createBooking(
  input: BookingInput & { notes: string; name?: string; email?: string; phone?: string },
): Promise<Result<{ reference: string; token: string }>> {
  try {
    const result = await api<{ data: Booking; token: string }>("/bookings", { method: "POST", body: input });
    return { ok: true, data: { reference: result.data.reference, token: result.token } };
  } catch (error) {
    return toFormState(error);
  }
}

/** Starts an online payment; the client then sends the browser to the gateway's checkout. */
export async function payBooking(reference: string, token: string, gateway: string): Promise<Result<{ reference: string; redirect_url: string }>> {
  try {
    const data = await api<{ reference: string; redirect_url: string }>(`/bookings/${reference}/pay`, { method: "POST", body: { gateway, token } });
    return { ok: true, data };
  } catch (error) {
    return toFormState(error);
  }
}

export async function submitBookingTransfer(reference: string, token: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = { sender_name: String(formData.get("sender_name") ?? ""), transferred_on: String(formData.get("transferred_on") ?? "") };
  const proof = formData.get("proof");
  if (!(proof instanceof File) || proof.size === 0) {
    return { ok: false, errors: { proof: ["Attach a photo or PDF of your transfer receipt."] }, values };
  }

  const form = new FormData();
  form.set("proof", proof, proof.name);
  form.set("sender_name", values.sender_name);
  form.set("transferred_on", values.transferred_on);
  form.set("token", token);

  try {
    await apiUpload<{ data: Payment }>(`/bookings/${reference}/bank-transfer`, form);
  } catch (error) {
    return toFormState(error, values);
  }
  refresh();
  return { ok: true, message: "Thanks! We'll confirm your transfer and your booking shortly." };
}

export async function cancelBooking(reference: string, token: string, reason: string): Promise<FormState> {
  try {
    await api(`/bookings/${reference}/cancel`, { method: "POST", body: { token, reason: reason || null } });
  } catch (error) {
    return toFormState(error);
  }
  refresh();
  return { ok: true, message: "Your booking is cancelled." };
}

/* ---------- Passes and memberships ---------- */

export async function buyPlan(kind: "passes" | "memberships", planId: number): Promise<Result<{ invoice_id: number }>> {
  try {
    const data = await api<{ invoice_id: number }>(`/plans/${kind}`, {
      method: "POST",
      body: kind === "passes" ? { pass_plan_id: planId } : { membership_plan_id: planId },
    });
    return { ok: true, data };
  } catch (error) {
    return toFormState(error);
  }
}

/* ---------- Admin ---------- */

async function adminCall(path: string, body: object | undefined, message: string): Promise<FormState> {
  try {
    await api(path, { method: "POST", body });
  } catch (error) {
    return toFormState(error);
  }
  refresh();
  return { ok: true, message };
}

export async function checkInByCode(code: string): Promise<Result<Booking>> {
  try {
    const { data } = await api<{ data: Booking }>("/admin/bookings/check-in", { method: "POST", body: { code } });
    refresh();
    return { ok: true, data, message: `${data.customer?.name ?? "Guest"} is checked in to ${data.space_name}.` };
  } catch (error) {
    return toFormState(error);
  }
}

export async function checkInBooking(reference: string): Promise<FormState> {
  return adminCall(`/admin/bookings/${reference}/check-in`, undefined, "Checked in.");
}

/** Ends a session in progress now; the customer gets the "session ended" message. */
export async function endSession(reference: string): Promise<FormState> {
  return adminCall(`/admin/bookings/${reference}/end`, undefined, "Session ended. The customer has been told.");
}

export async function approveBooking(reference: string): Promise<FormState> {
  return adminCall(`/admin/bookings/${reference}/approve`, undefined, "Booking approved. The customer has been asked to pay.");
}

export async function declineBooking(reference: string, reason: string): Promise<FormState> {
  return adminCall(`/admin/bookings/${reference}/decline`, { reason }, "Booking request declined.");
}

/** The space's seats for a booking's time, with which ones it holds now (staff moving a booking). */
export async function getBookingSeats(reference: string): Promise<Result<SeatMap>> {
  try {
    const { data } = await api<{ data: SeatMap }>(`/admin/bookings/${encodeURIComponent(reference)}/seats`);
    return { ok: true, data };
  } catch (error) {
    return toFormState(error);
  }
}

export async function moveBookingSeats(reference: string, seatIds: number[]): Promise<FormState> {
  try {
    await api(`/admin/bookings/${encodeURIComponent(reference)}/seats`, { method: "PUT", body: { seat_ids: seatIds } });
    refresh();
    return { ok: true, message: "Seat changed." };
  } catch (error) {
    return toFormState(error);
  }
}

export async function cancelBookingAsStaff(reference: string, reason: string, refundPercent: number): Promise<FormState> {
  return adminCall(`/admin/bookings/${reference}/cancel`, { reason, refund_percent: refundPercent }, "Booking cancelled.");
}

export async function saveBookingSettings(input: BookingSettings): Promise<Result<BookingSettings>> {
  try {
    const result = await api<{ data: BookingSettings; message: string }>("/admin/settings/workspace", { method: "PUT", body: input });
    // Every "Book a space" link on the site reads this.
    updateTag(BOOKING_SETTINGS_TAG);
    refresh();
    return { ok: true, data: result.data, message: result.message };
  } catch (error) {
    return toFormState(error);
  }
}

/* ---------- Discount codes on a held booking ---------- */

export async function applyBookingCoupon(reference: string, token: string, code: string): Promise<FormState> {
  try {
    await api(`/bookings/${reference}/coupon`, { method: "POST", body: { code, token } });
  } catch (error) {
    return toFormState(error);
  }
  refresh();
  return { ok: true, message: "Discount applied." };
}

export async function removeBookingCoupon(reference: string, token: string): Promise<FormState> {
  try {
    await api(`/bookings/${reference}/coupon?${new URLSearchParams({ token })}`, { method: "DELETE" });
  } catch (error) {
    return toFormState(error);
  }
  refresh();
  return { ok: true, message: "Discount removed." };
}
