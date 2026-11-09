import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Armchair, Building2, Calculator, ChevronRight, Globe, GraduationCap, HeartHandshake, Layers, Mailbox, MapPin, Mic, ShieldCheck } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { ButtonLink } from "@/components/ui/button";
import { academy, hq } from "@/content/site";

export const metadata: Metadata = {
  title: "About",
  description: "Reenite helps Nigerian founders register, stay compliant and get online, with a coworking space, podcast studio and tech academy in Uyo.",
};

/* The story is written from what Reenite does today. Replace it with the founders' own words when you have them. */
const story = [
  "Registering a business in Nigeria often means agents you can't reach, fees nobody explains and weeks of not knowing what is happening. Many good businesses stay unregistered because of it.",
  "We started Reenite to change that. Our legal experts handle the CAC registration and tax filings for you, every fee is shown before you pay, and you can follow each step from your dashboard.",
  "Around that work we built a home for people building things in Uyo: a coworking space, a podcast studio, events and an academy that trains the next generation of tech talent.",
];

const offerings = [
  { icon: Building2, title: "Business registration", body: "Business names, companies and NGOs registered with CAC.", href: "/services#business-registration" },
  { icon: Calculator, title: "Tax and compliance", body: "TIN, VAT, PAYE, annual returns and tax clearance.", href: "/services#tax-compliance" },
  { icon: Globe, title: "Online presence", body: "Domains, business email, websites and brand kits.", href: "/services#online-presence" },
  { icon: Mailbox, title: "Virtual address", body: "A professional business address with mail handling.", href: "/#virtual-address" },
  { icon: Armchair, title: "Workspace", body: "Hot desks, private offices, meeting rooms and event halls.", href: "/workspace" },
  { icon: Mic, title: "Podcast studio", body: "A sound-treated studio you can book by the hour.", href: "/#podcast" },
  { icon: GraduationCap, title: academy.name, body: "Tech scholarships in data, design, cybersecurity and more.", href: academy.url, external: true },
];

const values = [
  { icon: HeartHandshake, title: "A real person on every order", body: "Every customer gets a named legal expert who handles their filings and answers their questions." },
  { icon: ShieldCheck, title: "Done properly", body: "We register businesses the right way, so they are ready for banks, tenders and investors." },
  { icon: Layers, title: "Everything in one place", body: "Registration, tax, your website and your workspace, without juggling five different providers." },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About Reenite"
        title="We help Nigerian founders build businesses that last"
        body={`From our base at ${hq.street}, Uyo, Reenite registers businesses, keeps them compliant and gets them online, so founders can focus on growing.`}
        image={{ src: "/images/home/founder-tablet.jpg", alt: "A founder planning her business on a tablet" }}
      />

      <section className="bg-surface">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.4fr] lg:gap-16 lg:px-8">
          <h2 className="text-3xl font-semibold leading-[1.15] tracking-tight text-foreground sm:text-4xl">Why we started Reenite</h2>
          <div className="space-y-5 text-lg leading-relaxed text-muted">
            {story.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-surface-muted">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">What we do</h2>
          <p className="mt-3 max-w-2xl text-lg text-muted">One team for the paperwork, and one place to work, record and learn.</p>
          <ul className="mt-10 grid gap-x-10 sm:grid-cols-2">
            {offerings.map((item) => (
              <li key={item.title} className="border-b border-border">
                <Link
                  href={item.href}
                  {...(item.external ? { target: "_blank", rel: "noreferrer" } : {})}
                  className="group flex items-center gap-4 py-5 hover:[&_h3]:text-brand-600"
                >
                  <item.icon className="size-6 shrink-0 text-brand-500" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground transition-colors">{item.title}</h3>
                    <p className="mt-0.5 text-sm text-muted">{item.body}</p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">How we work</h2>
          <div className="mt-10 grid gap-10 md:grid-cols-3">
            {values.map((value) => (
              <div key={value.title} className="border-t-2 border-navy-900 pt-6 dark:border-white/30">
                <value.icon className="size-7 text-brand-500" />
                <h3 className="mt-4 text-lg font-bold text-foreground">{value.title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{value.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-surface px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl overflow-hidden rounded-md bg-navy-950 text-white lg:grid-cols-2">
          <div className="p-8 sm:p-12">
            <h2 className="text-3xl font-semibold tracking-tight">Come and see us</h2>
            <p className="mt-4 flex items-start gap-2 text-lg text-navy-200">
              <MapPin className="mt-1 size-5 shrink-0 text-brand-400" /> {hq.street}, {hq.city}, {hq.state}
            </p>
            <p className="mt-2 pl-7 text-navy-200">{hq.hoursShort}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/register" size="lg" variant="light">
                Get started
              </ButtonLink>
              <ButtonLink href="/contact" size="lg" variant="glass">
                Contact us
              </ButtonLink>
            </div>
          </div>
          <div className="relative min-h-64">
            <Image src="/images/home/coworking-lagos.jpg" alt="People working at shared desks" fill sizes="(min-width: 1024px) 640px, 100vw" className="object-cover" />
          </div>
        </div>
      </section>
    </>
  );
}
