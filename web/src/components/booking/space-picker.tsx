"use client";

import { Armchair, Check, DoorClosed, LayoutGrid, MapPin, Mic, PartyPopper, Users, type LucideIcon } from "lucide-react";
import type { Location, RateUnit, Space, SpaceType } from "@/lib/types";
import { cn, formatNaira } from "@/lib/utils";

const per: Record<RateUnit, string> = { hour: "hr", day: "day", week: "wk", month: "mo" };

/** A sensible icon for an admin-made space type, from its name. */
function typeIcon(type: SpaceType): LucideIcon {
  const name = `${type.slug} ${type.name}`.toLowerCase();
  if (/desk|regular|open/.test(name)) return Armchair;
  if (/meeting|conference/.test(name)) return Users;
  if (/event|hall/.test(name)) return PartyPopper;
  if (/podcast|studio|record/.test(name)) return Mic;
  if (/office|room/.test(name)) return DoorClosed;
  return LayoutGrid;
}

/**
 * Step one: where, what kind and which space, in one view. The location choice only appears
 * when there's more than one open; type buttons filter the spaces.
 */
export function SpacePicker({
  locations,
  locationId,
  onLocation,
  typeId,
  onType,
  selected,
  onSelect,
}: {
  locations: Location[];
  locationId: number;
  onLocation: (id: number) => void;
  typeId: number | null;
  onType: (id: number | null) => void;
  selected: string | null;
  onSelect: (slug: string) => void;
}) {
  const location = locations.find((item) => item.id === locationId) ?? locations[0];
  const spaces: Space[] = location?.spaces ?? [];
  const types = [...new Map(spaces.filter((space) => space.type).map((space) => [space.type!.id, space.type!])).values()];
  const shown = spaces.filter((space) => typeId === null || space.space_type_id === typeId);

  return (
    <div className="space-y-6">
      {locations.length > 1 && (
        <section>
          <h2 className="font-semibold text-foreground">Location</h2>
          <div role="radiogroup" aria-label="Location" className="mt-3 grid gap-3 md:grid-cols-2">
            {locations.map((item) => (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={item.id === location?.id}
                onClick={() => onLocation(item.id)}
                className={cn(
                  "flex min-w-0 items-start gap-3 rounded-xl border p-4 text-left transition",
                  item.id === location?.id ? "border-brand-500 bg-brand-50/40" : "border-border bg-surface hover:border-navy-200",
                )}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <MapPin className="size-5" />
                </span>
                <span>
                  <span className="block font-semibold text-foreground">{item.name}</span>
                  <span className="block text-sm text-muted">{item.address}, {item.city}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {types.length > 1 && (
        <section>
          <h2 className="font-semibold text-foreground">What type of space do you need?</h2>
          <div role="group" aria-label="Space type" className="mt-3 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
            {types.map((type) => {
              const Icon = typeIcon(type);
              const active = typeId === type.id;
              return (
                <button
                  key={type.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onType(active ? null : type.id)}
                  className={cn("flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition sm:p-4", active ? "border-brand-500 bg-brand-50/40" : "border-border bg-surface hover:border-navy-200")}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 sm:size-11">
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground sm:text-base">{type.name}</span>
                    {type.description && <span className="hidden truncate text-sm text-muted sm:block">{type.description}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-semibold text-foreground">Choose a space</h2>
        <div role="radiogroup" aria-label="Space" className="mt-3 space-y-3">
          {shown.map((space) => {
            const active = selected === space.slug;
            const rates = (space.rates ?? []).filter((rate) => rate.is_active);
            return (
              <button
                key={space.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onSelect(space.slug)}
                className={cn(
                  "flex w-full min-w-0 flex-col gap-3 rounded-xl border p-4 text-left transition sm:flex-row sm:items-center sm:justify-between sm:p-5",
                  active ? "border-brand-500 bg-brand-50/40 ring-2 ring-brand-500/15" : "border-border bg-surface hover:border-navy-200",
                )}
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2 font-semibold text-foreground">
                    {space.name}
                    {active && <Check className="size-4 text-brand-600" strokeWidth={3} />}
                  </span>
                  <span className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                    <Users className="size-4" /> Up to {space.capacity} {space.capacity === 1 ? "person" : "people"}
                  </span>
                  {space.summary && <span className="mt-1 block text-sm text-muted">{space.summary}</span>}
                </span>
                <span className="flex shrink-0 gap-4 text-sm sm:flex-col sm:items-end sm:gap-1">
                  {rates.map((rate) => (
                    <span key={rate.unit}>
                      <span className="font-semibold text-brand-600">{formatNaira(rate.price)}</span>
                      <span className="text-muted">/{per[rate.unit]}</span>
                    </span>
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
