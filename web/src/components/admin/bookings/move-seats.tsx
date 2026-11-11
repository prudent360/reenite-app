"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DotLoader } from "@/components/ui/loader";
import { getBookingSeats, moveBookingSeats } from "@/lib/actions/bookings";
import type { Booking, SeatMap } from "@/lib/types";
import { cn } from "@/lib/utils";

/** The booking's seats, with a way for staff to move it to other seats that are free at that time. */
export function MoveSeats({ booking, canMove }: { booking: Booking; canMove: boolean }) {
  const current = booking.assigned_seats ?? [];
  const [map, setMap] = useState<SeatMap | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [loading, startLoading] = useTransition();
  const [saving, startSaving] = useTransition();

  function open() {
    startLoading(async () => {
      const result = await getBookingSeats(booking.reference);
      if (!result.ok || !result.data) {
        toast.error(result.message ?? "We couldn't load the seats.");
        return;
      }
      setMap(result.data);
      setPicked(result.data.current ?? []);
    });
  }

  function save() {
    startSaving(async () => {
      const result = await moveBookingSeats(booking.reference, picked);
      if (result.ok) {
        toast.success(result.message);
        setMap(null);
      } else {
        toast.error(Object.values(result.errors ?? {})[0]?.[0] ?? result.message ?? "We couldn't move this booking.");
      }
    });
  }

  if (!map) {
    return (
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold">{current.map((seat) => seat.label).join(", ")}</span>
        {canMove && (
          <button type="button" onClick={open} disabled={loading} className="text-sm font-semibold text-brand-600 hover:underline disabled:opacity-60">
            {loading ? <DotLoader label="Loading seats" /> : "Change"}
          </button>
        )}
      </span>
    );
  }

  const toggle = (id: number) => setPicked((value) => (value.includes(id) ? value.filter((seat) => seat !== id) : [...value, id].slice(-booking.seats)));

  return (
    <div className="space-y-3">
      <p className="text-muted">
        Choose {booking.seats} {booking.seats === 1 ? "seat" : "seats"}. Taken seats are crossed out.
      </p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {map.seats.map((seat) => {
          const isPicked = picked.includes(seat.id);
          return (
            <button
              key={seat.id}
              type="button"
              aria-pressed={isPicked}
              disabled={!seat.available}
              onClick={() => toggle(seat.id)}
              className={cn(
                "rounded-lg border px-2 py-2 text-xs font-semibold transition",
                !seat.available && "cursor-not-allowed border-dashed bg-surface-muted text-muted line-through",
                seat.available && !isPicked && "border-border hover:border-brand-500",
                isPicked && "border-brand-500 bg-brand-500 text-white",
              )}
            >
              {seat.label}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={saving || picked.length !== booking.seats}>
          {saving ? <DotLoader className="text-current" label="Saving" /> : "Save seats"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setMap(null)} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
