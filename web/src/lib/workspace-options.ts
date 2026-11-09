import { api } from "@/lib/api";
import type { Addon, CancellationPolicy, Location, SpaceType } from "@/lib/types";

/** Everything the space editor's selects need, fetched together. */
export async function spaceFormOptions() {
  const [locations, types, policies, addons] = await Promise.all([
    api<{ data: Location[] }>("/admin/workspace/locations"),
    api<{ data: SpaceType[] }>("/admin/workspace/space-types"),
    api<{ data: CancellationPolicy[] }>("/admin/workspace/cancellation-policies"),
    api<{ data: Addon[] }>("/admin/workspace/addons"),
  ]);
  return { locations: locations.data, types: types.data, policies: policies.data, addons: addons.data };
}
