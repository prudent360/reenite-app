"use client";

import { useState, useTransition } from "react";
import { Armchair, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { TextField } from "@/components/ui/form";
import { DotLoader } from "@/components/ui/loader";
import { addSpaceSeats, deleteSpaceSeat, updateSpaceSeat } from "@/lib/actions/workspace";
import type { FormState, Space, SpaceSeat } from "@/lib/types";
import { cn } from "@/lib/utils";

const firstError = (result: FormState, fallback: string) => Object.values(result.errors ?? {})[0]?.[0] ?? result.message ?? fallback;

/**
 * Named seats for a shared space. With at least one seat switched on, customers can pick their
 * seat when booking (or take "any free seat"), and every booking is given seats.
 */
export function SeatManager({ space, seats }: { space: Space; seats: SpaceSeat[] }) {
  const [adding, setAdding] = useState({ prefix: "Desk", count: "10", zone: "" });
  const [pending, startTransition] = useTransition();
  const active = seats.filter((seat) => seat.is_active).length;

  function add(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await addSpaceSeats(space.id, { prefix: adding.prefix.trim(), count: Number(adding.count) || 1, zone: adding.zone.trim() });
      if (result.ok) toast.success(result.message);
      else toast.error(firstError(result, "We couldn't add those seats."));
    });
  }

  return (
    <Card>
      <CardHeader
        title="Seats"
        description={
          seats.length === 0
            ? "Add named seats so customers can choose where they sit. Without seats, people just book a number of places."
            : `${active} of ${seats.length} seats open. Customers pick from the open ones, or take any free seat.${active < space.capacity ? ` Bookings are limited to ${active} people at a time, below the capacity of ${space.capacity}.` : ""}`
        }
      />
      <form onSubmit={add} className="grid gap-3 border-b border-border p-5 sm:grid-cols-[1fr_90px_1fr_auto] sm:items-end sm:p-6">
        <TextField label="Name" name="prefix" value={adding.prefix} onChange={(event) => setAdding((value) => ({ ...value, prefix: event.target.value }))} hint="Numbered after this" required />
        <TextField label="How many" name="count" type="number" min={1} max={200} value={adding.count} onChange={(event) => setAdding((value) => ({ ...value, count: event.target.value }))} hint="Up to 200" required />
        <TextField label="Zone" name="zone" value={adding.zone} onChange={(event) => setAdding((value) => ({ ...value, zone: event.target.value }))} hint="Optional, e.g. Window" />
        <Button type="submit" disabled={pending} className="sm:mb-6">
          {pending ? <DotLoader className="text-current" label="Adding" /> : "Add seats"}
        </Button>
      </form>
      {seats.length > 0 ? (
        <ul className="divide-y divide-border">
          {seats.map((seat) => (
            <SeatRow key={seat.id} space={space} seat={seat} />
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 p-5 text-sm text-muted sm:p-6">
          <Armchair className="size-4" /> No seats yet.
        </p>
      )}
    </Card>
  );
}

function SeatRow({ space, seat }: { space: Space; seat: SpaceSeat }) {
  const [label, setLabel] = useState(seat.label);
  const [zone, setZone] = useState(seat.zone ?? "");
  const [pending, startTransition] = useTransition();
  const changed = label.trim() !== seat.label || zone.trim() !== (seat.zone ?? "");

  const run = (action: () => Promise<FormState>, fallback: string) =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(result.message);
      else toast.error(firstError(result, fallback));
    });

  return (
    <li className={cn("flex flex-wrap items-center gap-2 px-5 py-3 sm:px-6", !seat.is_active && "opacity-60")}>
      <input
        aria-label={`Name of ${seat.label}`}
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        maxLength={40}
        className="h-9 w-32 rounded-lg border border-border bg-surface px-2.5 text-sm font-semibold text-foreground focus:border-brand-500 focus:outline-none"
      />
      <input
        aria-label={`Zone of ${seat.label}`}
        value={zone}
        placeholder="Zone"
        onChange={(event) => setZone(event.target.value)}
        maxLength={60}
        className="h-9 w-32 flex-1 rounded-lg border border-border bg-surface px-2.5 text-sm text-foreground focus:border-brand-500 focus:outline-none"
      />
      {changed && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => updateSpaceSeat(space.id, seat.id, { label: label.trim(), zone: zone.trim() || null }), "We couldn't save that seat.")}>
          Save
        </Button>
      )}
      <label className="flex cursor-pointer items-center gap-1.5 text-sm text-muted">
        <input
          type="checkbox"
          checked={seat.is_active}
          disabled={pending}
          onChange={(event) => run(() => updateSpaceSeat(space.id, seat.id, { is_active: event.target.checked }), "We couldn't update that seat.")}
          className="size-4 accent-brand-500"
        />
        Open
      </label>
      <Button
        size="sm"
        variant="ghost"
        aria-label={`Delete ${seat.label}`}
        disabled={pending || (seat.bookings_count ?? 0) > 0}
        title={(seat.bookings_count ?? 0) > 0 ? "This seat has bookings. Switch it off instead." : undefined}
        onClick={() => run(() => deleteSpaceSeat(space.id, seat.id), "We couldn't delete that seat.")}
      >
        <Trash2 className="size-4" />
      </Button>
    </li>
  );
}
