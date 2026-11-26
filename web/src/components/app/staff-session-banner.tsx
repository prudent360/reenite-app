"use client";

import { useTransition } from "react";
import { ArrowLeft, UserRoundCog } from "lucide-react";
import { backToAdmin } from "@/lib/actions/staff-session";
import { DotLoader } from "@/components/ui/loader";

/** Shown across the customer dashboard while a staff member is signed in as the customer. */
export function StaffSessionBanner({ customerName, staffName }: { customerName: string; staffName: string }) {
  const [pending, startTransition] = useTransition();

  function goBack() {
    startTransition(async () => {
      const href = await backToAdmin();
      // A full page load, so none of the customer's pages stay cached in the browser.
      window.location.assign(href);
    });
  }

  return (
    <div role="status" className="mb-6 flex flex-col gap-3 rounded-2xl bg-navy-900 px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="flex items-start gap-3 text-sm">
        <UserRoundCog className="mt-0.5 size-5 shrink-0 text-brand-300" />
        <span>
          <span className="font-semibold">You&apos;re signed in as {customerName}.</span>{" "}
          <span className="text-white/75">Anything you do here is done for them and recorded under your name, {staffName}.</span>
        </span>
      </p>
      <button
        type="button"
        onClick={goBack}
        disabled={pending}
        className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-white px-4 text-sm font-semibold text-navy-900 hover:bg-white/90 disabled:opacity-70"
      >
        {pending ? <DotLoader className="text-navy-900" label="Going back" /> : <><ArrowLeft className="size-4" /> Back to admin</>}
      </button>
    </div>
  );
}
