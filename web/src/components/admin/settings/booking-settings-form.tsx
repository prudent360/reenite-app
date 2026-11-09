"use client";

import { useState, useTransition } from "react";
import { AlertCircle, ArrowUpRight, Check, Globe, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";
import { Alert, Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/form";
import { DotLoader } from "@/components/ui/loader";
import { saveBookingSettings } from "@/lib/actions/bookings";
import type { BookingSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

const choices = [
  {
    value: "external" as const,
    icon: Globe,
    title: "On the booking site",
    body: "Every \"Book a space\" button opens the separate booking site. Booking on this site is paused.",
  },
  {
    value: "internal" as const,
    icon: LayoutDashboard,
    title: "On this site",
    body: "People book and pay here, using the spaces, prices and policies under Workspace. Bookings appear under Bookings.",
  },
];

/** The switch between taking bookings here and sending people to the booking site. */
export function BookingSettingsForm({ settings }: { settings: BookingSettings }) {
  const [destination, setDestination] = useState(settings.destination);
  const [url, setUrl] = useState(settings.external_url);
  const [error, setError] = useState<string | undefined>();
  const [saving, startSaving] = useTransition();
  const changed = destination !== settings.destination || url !== settings.external_url;

  function save() {
    setError(undefined);
    startSaving(async () => {
      const result = await saveBookingSettings({ destination, external_url: url });
      if (result.ok) toast.success(result.message);
      else {
        setError(result.errors?.external_url?.[0]);
        if (!result.errors) toast.error(result.message ?? "Couldn't save.");
      }
    });
  }

  return (
    <Card>
      <CardHeader title="Where do people book spaces?" description="Switch any time. Bookings already made stay where they were made." />
      <div className="space-y-5 p-5 sm:p-6">
        <div role="radiogroup" aria-label="Where people book" className="grid gap-3 md:grid-cols-2">
          {choices.map((choice) => (
            <button
              key={choice.value}
              type="button"
              role="radio"
              aria-checked={destination === choice.value}
              onClick={() => setDestination(choice.value)}
              className={cn(
                "flex gap-3 rounded-xl border p-4 text-left transition",
                destination === choice.value ? "border-brand-500 bg-brand-50/50 ring-2 ring-brand-500/20" : "border-border hover:border-navy-200",
              )}
            >
              <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", destination === choice.value ? "bg-brand-500 text-white" : "bg-navy-50 text-foreground")}>
                <choice.icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-semibold text-foreground">
                  {choice.title}
                  {settings.destination === choice.value && <span className="text-xs font-medium text-success">Current</span>}
                </span>
                <span className="mt-0.5 block text-sm text-muted">{choice.body}</span>
              </span>
              {destination === choice.value && <Check className="size-5 shrink-0 text-brand-500" />}
            </button>
          ))}
        </div>

        <TextField
          label="Booking site address"
          name="external_url"
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          error={error ? [error] : undefined}
          hint="Used while bookings happen on the booking site."
        />

        {destination === "internal" && settings.destination !== "internal" && (
          <Alert tone="warning" icon={AlertCircle} title="Before you switch">
            Check your spaces, prices, opening hours and cancellation policies under Workspace, and turn on a payment gateway, so people can book and pay
            straight away.
          </Alert>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save} disabled={!changed || saving}>
            {saving ? <DotLoader className="text-current" label="Saving" /> : "Save"}
          </Button>
          <a href={destination === "internal" ? "/book" : url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
            Preview where it goes <ArrowUpRight className="size-3.5" />
          </a>
        </div>
      </div>
    </Card>
  );
}
