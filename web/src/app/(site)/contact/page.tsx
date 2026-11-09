import type { Metadata } from "next";
import Link from "next/link";
import { Armchair, Building2, ChevronRight, Clock, GraduationCap, MapPin, MessageSquare, Mic, Phone, UserRound } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { buttonClasses } from "@/components/ui/button";
import { hq } from "@/content/site";

export const metadata: Metadata = {
  title: "Contact",
  description: `Visit Reenite at ${hq.street}, Uyo, call ${hq.phone} or chat with us on WhatsApp.`,
};

/** Each topic opens WhatsApp with a first message already typed, so people know what to say. */
const topics = [
  { icon: Building2, title: "Registering or filing", message: "Hi Reenite, I'd like help registering my business." },
  { icon: Armchair, title: "Booking a space", message: "Hi Reenite, I'd like to book a space at the hub." },
  { icon: Mic, title: "The podcast studio", message: "Hi Reenite, I'd like to know more about the podcast studio." },
  { icon: GraduationCap, title: "Reenite Academy", message: "Hi Reenite, I have a question about the Academy scholarship." },
];

const mapQuery = encodeURIComponent(`Reenite, ${hq.street}, ${hq.city}, ${hq.state}`);

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Let's talk about your business"
        body="The quickest way to reach us is WhatsApp. You can also call, or visit us in Uyo."
      >
        <div className="mt-8 flex flex-wrap gap-3">
          <a href={hq.whatsapp} className={buttonClasses({ size: "lg", variant: "light" })}>
            <MessageSquare className="size-4" /> Chat on WhatsApp
          </a>
          <a href={hq.phoneHref} className={buttonClasses({ size: "lg", variant: "glass" })}>
            Call {hq.phone}
          </a>
        </div>
      </PageHero>

      <section className="bg-surface">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.3fr] lg:px-8">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">What can we help with?</h2>
            <ul className="mt-6 border-t border-border">
              {topics.map((topic) => (
                <li key={topic.title} className="border-b border-border">
                  <a
                    href={`${hq.whatsapp}?text=${encodeURIComponent(topic.message)}`}
                    className="group flex items-center gap-4 py-4 hover:[&_span]:text-brand-600"
                  >
                    <topic.icon className="size-5 shrink-0 text-brand-500" />
                    <span className="flex-1 font-semibold text-foreground transition-colors">{topic.title}</span>
                    <ChevronRight className="size-5 text-muted transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
                  </a>
                </li>
              ))}
            </ul>

            <dl className="mt-10 space-y-6">
              <div className="flex gap-4">
                <MapPin className="mt-0.5 size-5 shrink-0 text-brand-500" />
                <div>
                  <dt className="font-semibold text-foreground">Visit</dt>
                  <dd className="mt-1 text-muted">
                    {hq.street}
                    <br />
                    {hq.city}, {hq.state}
                  </dd>
                </div>
              </div>
              <div className="flex gap-4">
                <Phone className="mt-0.5 size-5 shrink-0 text-brand-500" />
                <div>
                  <dt className="font-semibold text-foreground">Call or WhatsApp</dt>
                  <dd className="mt-1">
                    <a href={hq.phoneHref} className="text-muted hover:text-foreground hover:underline">
                      {hq.phone}
                    </a>
                  </dd>
                </div>
              </div>
              <div className="flex gap-4">
                <Clock className="mt-0.5 size-5 shrink-0 text-brand-500" />
                <div>
                  <dt className="font-semibold text-foreground">Opening hours</dt>
                  <dd className="mt-1">
                    <ul className="text-muted">
                      {hq.hours.map((row) => (
                        <li key={row.days}>
                          {row.days}: {row.time}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              </div>
              <div className="flex gap-4">
                <UserRound className="mt-0.5 size-5 shrink-0 text-brand-500" />
                <div>
                  <dt className="font-semibold text-foreground">Already a customer?</dt>
                  <dd className="mt-1 text-muted">
                    Message your legal expert from your{" "}
                    <Link href="/dashboard/messages" className="font-semibold text-brand-600 hover:underline">
                      dashboard
                    </Link>{" "}
                    and the reply stays with your order.
                  </dd>
                </div>
              </div>
            </dl>
          </div>

          <div className="flex flex-col">
            <div className="relative min-h-[360px] flex-1 overflow-hidden rounded-md border border-border bg-surface-muted">
              <iframe
                title={`Map showing Reenite at ${hq.street}, ${hq.city}`}
                src={`https://maps.google.com/maps?q=${mapQuery}&z=16&output=embed`}
                className="absolute inset-0 size-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 text-sm font-semibold text-brand-600 hover:underline"
            >
              Open in Google Maps for directions
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
