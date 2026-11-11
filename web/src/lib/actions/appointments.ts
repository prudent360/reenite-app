"use server";

import { refresh } from "next/cache";
import { api, toFormState } from "@/lib/api";
import type { Appointment, AppointmentClient, AppointmentSettings, ClientAppointment, FormState } from "@/lib/types";

type Result<T> = FormState & { data?: T };

export type AppointmentInput = {
  client_id?: number | null;
  client?: { name: string; email: string; phone: string; whatsapp_consent: boolean } | null;
  title: string;
  mode: string;
  meeting_details: string | null;
  /** Lagos time, "2026-11-12 10:00". */
  starts_at: string;
  duration_minutes: number;
  assigned_to: number | null;
  staff_notes: string | null;
};

export async function searchAppointmentClients(search: string): Promise<Result<AppointmentClient[]>> {
  try {
    const { data } = await api<{ data: AppointmentClient[] }>(`/admin/appointments/clients?${new URLSearchParams({ search })}`);
    return { ok: true, data };
  } catch (error) {
    return toFormState(error);
  }
}

export async function createAppointment(input: AppointmentInput): Promise<Result<Appointment>> {
  try {
    const { data } = await api<{ data: Appointment }>("/admin/appointments", { method: "POST", body: input });
    return { ok: true, data, message: `Booked. ${data.client?.name ?? "The client"} has been sent the details.` };
  } catch (error) {
    return toFormState(error);
  }
}

export async function updateAppointment(reference: string, input: Partial<AppointmentInput>): Promise<Result<Appointment>> {
  try {
    const { data } = await api<{ data: Appointment }>(`/admin/appointments/${encodeURIComponent(reference)}`, { method: "PATCH", body: input });
    refresh();
    return { ok: true, data, message: "Saved." };
  } catch (error) {
    return toFormState(error);
  }
}

export async function cancelAppointment(reference: string, reason: string): Promise<FormState> {
  try {
    await api(`/admin/appointments/${encodeURIComponent(reference)}/cancel`, { method: "POST", body: { reason } });
    refresh();
    return { ok: true, message: "Appointment cancelled. The client has been told." };
  } catch (error) {
    return toFormState(error);
  }
}

export async function recordAppointmentOutcome(reference: string, outcome: "attended" | "no_show", minutesLate: number): Promise<FormState> {
  try {
    await api(`/admin/appointments/${encodeURIComponent(reference)}/outcome`, { method: "POST", body: { outcome, minutes_late: minutesLate } });
    refresh();
    return { ok: true, message: outcome === "no_show" ? "Marked as a no-show." : "Attendance recorded." };
  } catch (error) {
    return toFormState(error);
  }
}

export async function saveAppointmentSettings(input: { arrive_early_minutes: number; grace_minutes: number }): Promise<Result<AppointmentSettings>> {
  try {
    const { data, message } = await api<{ data: AppointmentSettings; message: string }>("/admin/appointments/settings", { method: "PUT", body: input });
    refresh();
    return { ok: true, data, message };
  } catch (error) {
    return toFormState(error);
  }
}

/** The client confirms, or asks for another time, from the link in their messages. */
export async function respondToAppointment(reference: string, token: string, response: "confirmed" | "reschedule_requested", note: string): Promise<Result<ClientAppointment>> {
  try {
    const { data } = await api<{ data: ClientAppointment }>(`/appointments/${encodeURIComponent(reference)}/respond`, {
      method: "POST",
      body: { token, response, note: note || null },
      anonymous: true,
    });
    refresh();
    return { ok: true, data };
  } catch (error) {
    return toFormState(error);
  }
}
