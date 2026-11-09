import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Check, Clock, MapPin, MessageSquare, Phone } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { Plans } from "@/components/site/plans";
import { WorkspaceFinder } from "@/components/site/workspace-finder";
import { amenities, bookingSteps, extras, hq } from "@/content/site";
import { getBookingSettings } from "@/lib/booking";

export const metadata: Metadata = {
  title: "Workspace",
  description: "Hot desks, private offices, a meeting room, a podcast studio and event halls at 162 Oron Road, Uyo. Book by the hour, day, week or month.",
};

export default async function WorkspacePage() {
  // With booking on this site, /book lists the live spaces and prices from the admin.
  if ((await getBookingSettings()).destination === "internal") {
    redirect("/book");
  }

  return (
    <>
      <PageHero
        eyebrow="Workspace in Uyo"
        title="Your desk is ready. Just show up."
        body="Hot desks, private offices, a meeting room, a podcast studio and event halls, booked in minutes. Pay by the hour, day, week or month."
        image={{ src: "/images/home/private-office.jpg", alt: "A quiet private office ready for work" }}
      >
        <ul className="mt-8 flex flex-wrap gap-x-7 gap-y-3 text-sm text-navy-200">
          <li className="flex items-center gap-2">
            <MapPin className="size-4 text-brand-400" /> {hq.street}, {hq.city}
          </li>
          <li className="flex items-center gap-2">
            <Clock className="size-4 text-brand-400" /> {hq.hoursShort}
          </li>
          <li className="flex items-center gap-2">
            <Phone className="size-4 text-brand-400" /> {hq.phone}
          </li>
        </ul>
      </PageHero>

      <section id="spaces" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Find a space</h2>
        <p className="mt-2 text-muted">Prices start from the hourly rate. Daily, weekly and monthly rates are shown when you book.</p>
        <div className="mt-8">
          {/* The filters start from the URL query, which isn't known while prerendering. */}
          <Suspense fallback={<div className="skeleton h-96 rounded-md" />}>
            <WorkspaceFinder />
          </Suspense>
        </div>
        <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          {amenities.map((item) => (
            <li key={item} className="flex items-center gap-2">
              <Check className="size-4 text-brand-500" strokeWidth={3} /> {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="border-y border-border bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl">From search to seat in four steps</h2>
          <ol className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {bookingSteps.map((step, index) => (
              <li key={step.title} className="border-t-2 border-border pt-5 first:border-brand-500">
                <span className="font-display text-sm font-bold text-brand-600">{String(index + 1).padStart(2, "0")}</span>
                <h3 className="mt-2 text-lg font-bold text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <Plans />

      <section className="bg-surface">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.4fr_1fr] lg:px-8">
          <div>
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">More than a desk</h2>
            <div className="mt-8 grid gap-8 sm:grid-cols-2">
              {extras.map((item) => (
                <div key={item.title} className="flex gap-4">
                  <item.icon className="mt-0.5 size-6 shrink-0 text-brand-500" />
                  <div>
                    <h3 className="font-bold text-foreground">{item.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md bg-navy-950 p-7 text-white">
            <h2 className="text-xl font-bold">Come and find us</h2>
            <p className="mt-3 flex items-start gap-2 text-navy-200">
              <MapPin className="mt-0.5 size-4 shrink-0 text-brand-400" /> {hq.street}, {hq.city}, {hq.state}
            </p>
            <dl className="mt-6 space-y-3 text-sm">
              {hq.hours.map((row) => (
                <div key={row.days} className="flex justify-between gap-4 border-b border-white/10 pb-3 last:border-0">
                  <dt className="text-navy-200">{row.days}</dt>
                  <dd className="font-semibold">{row.time}</dd>
                </div>
              ))}
            </dl>
            <a
              href={hq.whatsapp}
              className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-brand-500 text-sm font-semibold text-white hover:bg-brand-600"
            >
              <MessageSquare className="size-4" /> Chat on WhatsApp
            </a>
            <a href={hq.phoneHref} className="mt-3 block text-center text-sm font-semibold text-navy-200 hover:text-white">
              Or call {hq.phone}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
