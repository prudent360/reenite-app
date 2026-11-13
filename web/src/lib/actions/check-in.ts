"use server";

import { refresh } from "next/cache";
import { api, toFormState } from "@/lib/api";
import type { FormState, SelfCheckInBooking, SelfCheckInSettings } from "@/lib/types";

type Result<T> = FormState & { data?: T };

/** The customer checking themselves in: by booking reference when signed in, or by the code from their confirmation. */
export async function selfCheckIn(token: string, input: { reference: string } | { code: string }): Promise<Result<SelfCheckInBooking>> {
  try {
    const { data, message } = await api<{ data: SelfCheckInBooking; message: string }>(`/check-in/${encodeURIComponent(token)}`, { method: "POST", body: input });
    return { ok: true, data, message };
  } catch (error) {
    return toFormState(error);
  }
}

export async function setSelfCheckIn(locationId: number, enabled: boolean): Promise<Result<SelfCheckInSettings>> {
  try {
    const { data } = await api<{ data: SelfCheckInSettings }>(`/admin/workspace/locations/${locationId}/self-check-in`, { method: "PUT", body: { enabled } });
    refresh();
    return { ok: true, data, message: enabled ? "Self check-in is on. Print the poster for reception." : "Self check-in is off. The poster no longer works." };
  } catch (error) {
    return toFormState(error);
  }
}

export async function regenerateSelfCheckIn(locationId: number): Promise<Result<SelfCheckInSettings>> {
  try {
    const { data } = await api<{ data: SelfCheckInSettings }>(`/admin/workspace/locations/${locationId}/self-check-in/regenerate`, { method: "POST" });
    refresh();
    return { ok: true, data, message: "New link made. Old posters no longer work, so print the new one." };
  } catch (error) {
    return toFormState(error);
  }
}
