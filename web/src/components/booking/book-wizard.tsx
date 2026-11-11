"use client";

import { useState, useTransition } from "react";
import type { BookingPreset } from "@/lib/booking-format";
import { AlertCircle, ArrowRight } from "lucide-react";
import { BookForm } from "@/components/booking/book-form";
import { SpacePicker } from "@/components/booking/space-picker";
import { Stepper } from "@/components/booking/stepper";
import { Button } from "@/components/ui/button";
import { Alert, Card } from "@/components/ui/card";
import { DotLoader } from "@/components/ui/loader";
import { getSpace } from "@/lib/actions/bookings";
import type { Location, Space, User } from "@/lib/types";

/**
 * Booking in three steps (then paying on the booking page): Space, Time, Details.
 * Location, type and space share step one; the time and details steps share one form, so going
 * back and forth keeps what the customer entered.
 */
export function BookWizard({
  locations,
  user,
  initialSpace = null,
  preset,
  inDashboard = false,
}: {
  locations: Location[];
  user: User | null;
  initialSpace?: Space | null;
  /** Date, time and length from a link; applies to the space the page opened with. */
  preset?: BookingPreset;
  inDashboard?: boolean;
}) {
  const [step, setStep] = useState(initialSpace ? 1 : 0);
  const [locationId, setLocationId] = useState(initialSpace?.location_id ?? locations[0]?.id ?? 0);
  const [typeId, setTypeId] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(initialSpace?.slug ?? null);
  const [space, setSpace] = useState<Space | null>(initialSpace);
  const [loading, startLoading] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function go(next: number) {
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function continueWithSpace() {
    if (!selected) return;
    if (space?.slug === selected) {
      go(1);
      return;
    }
    setError(null);
    startLoading(async () => {
      const result = await getSpace(selected);
      if (result.ok && result.data) {
        setSpace(result.data);
        go(1);
      } else setError(result.message ?? "We couldn't open that space. Please try again.");
    });
  }

  return (
    <div className="space-y-6">
      <Stepper current={step} onSelect={go} />

      {step === 0 && (
        <Card className="p-5 sm:p-6">
          <SpacePicker
            locations={locations}
            locationId={locationId}
            onLocation={(id) => {
              setLocationId(id);
              setTypeId(null);
              setSelected(null);
            }}
            typeId={typeId}
            onType={setTypeId}
            selected={selected}
            onSelect={setSelected}
          />
          {error && (
            <Alert tone="danger" icon={AlertCircle} className="mt-5">
              {error}
            </Alert>
          )}
          <div className="mt-6 flex justify-end">
            <Button size="lg" disabled={!selected || loading} onClick={continueWithSpace}>
              {loading ? <DotLoader className="text-current" label="Opening" /> : <>Continue <ArrowRight className="size-4" /></>}
            </Button>
          </div>
        </Card>
      )}

      {/* Stays mounted while on step one, so the chosen time survives a look back at the spaces. */}
      {space && (
        <div hidden={step === 0}>
          <BookForm
            key={space.slug}
            space={space}
            user={user}
            step={step === 2 ? "details" : "time"}
            onNext={() => go(2)}
            onBack={() => go(step - 1)}
            inDashboard={inDashboard}
            preset={space.slug === initialSpace?.slug ? preset : undefined}
          />
        </div>
      )}
    </div>
  );
}
