import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { PrintButton } from "@/components/billing/print-button";
import { Logo } from "@/components/brand/logo";
import { QrCode } from "@/components/booking/check-in-qr";
import { Alert } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { ApiError, api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import type { SelfCheckInSettings } from "@/lib/types";

/** An A4 poster for reception. Printing hides the admin sidebar and header. */
export default function SelfCheckInPosterPage({ params }: PageProps<"/admin/workspace/locations/[id]/poster">) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-[760px] max-w-2xl rounded-3xl" />}>
      {params.then(({ id }) => (
        <Poster id={id} />
      ))}
    </Suspense>
  );
}

async function Poster({ id }: { id: string }) {
  await requireStaff("workspace.manage");
  let settings: SelfCheckInSettings;
  try {
    ({ data: settings } = await api<{ data: SelfCheckInSettings }>(`/admin/workspace/locations/${encodeURIComponent(id)}/self-check-in`));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <title>{`Check-in poster | ${settings.location_name}`}</title>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/admin/workspace/locations/${settings.location_id}`} className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-foreground">
          <ArrowLeft className="size-4" /> {settings.location_name}
        </Link>
        <PrintButton />
      </div>
      {!settings.enabled && (
        <Alert tone="warning" className="mb-4 print:hidden">
          Self check-in is switched off for this location, so the poster won&apos;t work until you switch it on.
        </Alert>
      )}

      <article className="overflow-hidden rounded-3xl border border-border bg-white text-center text-[#1a2142] shadow-pop print:rounded-none print:border-0 print:shadow-none">
        <header className="flex items-center justify-center bg-[#10152c] px-8 py-7">
          <Logo tone="light" href={null} className="!h-9" />
        </header>
        <div className="px-8 py-10 sm:px-14">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#e2552b]">{settings.location_name}</p>
          <h1 className="mt-2 text-4xl font-extrabold sm:text-5xl">Check in here</h1>
          <p className="mx-auto mt-3 max-w-md text-lg text-[#4a5275]">Scan with your phone camera. No app needed.</p>
          <QrCode value={settings.url} label="Self check-in QR code" className="mx-auto mt-8 aspect-square w-72 rounded-2xl border-2 border-[#10152c] bg-white p-5 sm:w-80" />
          <ol className="mx-auto mt-10 grid max-w-lg gap-4 text-left sm:grid-cols-3">
            {[
              ["Scan", "Point your camera at the code and open the link."],
              ["Choose", "Tap your booking, or type the code from your confirmation."],
              ["Settle in", "You're checked in. Find your space and get to work."],
            ].map(([title, text], index) => (
              <li key={title} className="rounded-2xl bg-[#f3f4f8] p-4">
                <span className="grid size-8 place-items-center rounded-full bg-[#10152c] text-sm font-bold text-white">{index + 1}</span>
                <p className="mt-3 font-bold">{title}</p>
                <p className="mt-1 text-sm text-[#4a5275]">{text}</p>
              </li>
            ))}
          </ol>
        </div>
        <footer className="border-t border-[#e3e6ef] px-8 py-5 text-sm text-[#4a5275]">Check-in opens 30 minutes before your booking. Need help? Ask at the front desk.</footer>
      </article>
    </div>
  );
}
