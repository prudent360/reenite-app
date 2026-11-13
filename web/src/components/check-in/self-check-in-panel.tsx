"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertCircle, Armchair, CircleCheck, Clock, MapPin, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Badge, Card } from "@/components/ui/card";
import { DotLoader } from "@/components/ui/loader";
import { selfCheckIn } from "@/lib/actions/check-in";
import { formatBookingTime, formatWhen } from "@/lib/booking-format";
import type { SelfCheckInBooking, SelfCheckInPage } from "@/lib/types";

/**
 * Self check-in at reception. Signed-in customers see today's bookings here and tap one; anyone
 * else (or a guest booking) types the six-character code from their confirmation.
 */
export function SelfCheckInPanel({ token, page }: { token: string; page: SelfCheckInPage }) {
  const [done, setDone] = useState<{ booking: SelfCheckInBooking; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function checkIn(input: { reference: string } | { code: string }, key: string) {
    setError(null);
    setBusy(key);
    startTransition(async () => {
      const result = await selfCheckIn(token, input);
      setBusy(null);
      if (result.ok && result.data) {
        setDone({ booking: result.data, message: result.message ?? "You're checked in." });
      } else {
        setError(result.errors?.code?.[0] ?? result.message ?? "We couldn't check you in. Please ask at the front desk.");
      }
    });
  }

  if (done) {
    const { booking } = done;
    return (
      <Card className="overflow-hidden text-center">
        <div className="bg-success/10 px-6 py-8">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-success text-white">
            <CircleCheck className="size-9" />
          </span>
          <h1 className="mt-4 text-2xl font-bold text-foreground">{done.message}</h1>
        </div>
        <dl className="space-y-3 px-6 py-6 text-left text-sm">
          <Row icon={Armchair} label="Space" value={booking.seats.length ? `${booking.space_name} · ${booking.seats.join(", ")}` : booking.space_name} />
          <Row icon={Clock} label="Until" value={formatBookingTime(booking.ends_at)} />
        </dl>
        <p className="border-t border-border px-6 py-4 text-xs text-muted">You can close this page. Enjoy your session.</p>
      </Card>
    );
  }

  const location = page.location;

  return (
    <div className="space-y-5">
      <div className="text-center">
        <span className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-brand-500/10 text-brand-600">
          <ScanLine className="size-6" />
        </span>
        <h1 className="text-2xl font-bold text-foreground">Check in at {location.name}</h1>
        <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-muted">
          <MapPin className="size-4" /> {location.address}, {location.city}
        </p>
      </div>

      {error && (
        <Alert tone="danger" icon={AlertCircle}>
          {error}
        </Alert>
      )}

      {page.signed_in && (
        <Card className="overflow-hidden">
          <p className="border-b border-border px-5 py-3.5 text-sm font-semibold text-foreground">
            {page.customer_name ? `Hi ${page.customer_name.split(" ")[0]}, your bookings today` : "Your bookings today"}
          </p>
          {page.bookings.length === 0 ? (
            <p className="px-5 py-5 text-sm text-muted">No bookings here today on this account. If someone booked for you, use the code from your confirmation below.</p>
          ) : (
            <ul className="divide-y divide-border">
              {page.bookings.map((booking) => (
                <li key={booking.reference} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">
                      {booking.space_name}
                      {booking.seats.length > 0 && <span className="font-normal text-muted"> · {booking.seats.join(", ")}</span>}
                    </p>
                    <p className="text-sm text-muted">{formatWhen(booking)}</p>
                  </div>
                  {booking.status === "checked_in" ? (
                    <Badge tone="success">Checked in {booking.checked_in_at ? formatBookingTime(booking.checked_in_at) : ""}</Badge>
                  ) : booking.can_check_in ? (
                    <Button onClick={() => checkIn({ reference: booking.reference }, booking.reference)} disabled={pending}>
                      {busy === booking.reference ? <DotLoader className="text-current" label="Checking in" /> : "Check in"}
                    </Button>
                  ) : (
                    <span className="text-sm text-muted">Opens {formatBookingTime(booking.opens_at)}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card className="p-5">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (code.trim()) checkIn({ code: code.trim() }, "code");
          }}
          className="space-y-3"
        >
          <label className="block space-y-1.5">
            <span className="block text-sm font-semibold text-foreground">{page.signed_in ? "Or enter a booking code" : "Enter your booking code"}</span>
            <span className="block text-[13px] text-muted">It&apos;s the six-character code in your confirmation email and on your booking pass.</span>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="e.g. K7Q2MX"
              autoComplete="off"
              autoCapitalize="characters"
              maxLength={12}
              className="h-12 w-full rounded-xl border border-border bg-surface px-3 text-center font-mono text-xl tracking-[0.3em] text-foreground placeholder:font-sans placeholder:text-sm placeholder:tracking-normal focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
            />
          </label>
          <Button type="submit" size="lg" className="w-full" disabled={pending || !code.trim()}>
            {busy === "code" ? <DotLoader className="text-current" label="Checking in" /> : "Check in"}
          </Button>
        </form>
      </Card>

      <p className="text-center text-sm text-muted">
        {!page.signed_in && (
          <>
            Have an account?{" "}
            <Link href={`/login?${new URLSearchParams({ next: `/check-in/${token}` })}`} className="font-semibold text-brand-600 hover:underline">
              Sign in
            </Link>{" "}
            to see your bookings.{" "}
          </>
        )}
        Check-in opens {page.opens_minutes_before} minutes before your start time.
      </p>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted" />
      <dt className="w-16 shrink-0 text-muted">{label}</dt>
      <dd className="font-semibold text-foreground">{value}</dd>
    </div>
  );
}
