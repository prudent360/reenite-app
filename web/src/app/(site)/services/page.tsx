import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Clock, CloudOff, MessageSquare } from "lucide-react";
import { turnaroundLabel } from "@/components/catalogue/service-display";
import { CategoryIcon } from "@/components/catalogue/category-icon";
import { PageHero } from "@/components/site/page-hero";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { hq } from "@/content/site";
import { getCatalogue } from "@/lib/catalogue";
import { categoryPhotos } from "@/lib/category-photos";
import type { Bundle, Service, ServiceCategory } from "@/lib/types";
import { formatNaira } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Services",
  description: "CAC registration, tax filing, regulatory licences and online presence for Nigerian businesses, with transparent pricing.",
};

/*
 * The services page reads like a price list: each category has its heading on the left
 * and its services as rows on the right, so prices and turnaround times line up for comparing.
 */
export default async function ServicesPage() {
  const catalogue = await getCatalogue();
  const categories = (catalogue?.categories ?? []).filter((category) => (category.services ?? []).length > 0);

  return (
    <>
      <PageHero
        eyebrow="Services and prices"
        title="Everything your business needs to be official and visible"
        body="Our legal experts handle every registration and tax filing for you. Every price below includes government fees, and we show them separately before you pay."
        image={{ src: "/images/home/consultant-window.jpg", alt: "A Reenite legal expert reviewing a customer's documents" }}
      >
        {categories.length > 0 && (
          <nav aria-label="Service categories" className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium">
            {categories.map((category) => (
              <a key={category.id} href={`#${category.slug}`} className="inline-flex items-center gap-2 text-navy-100 hover:text-white">
                <CategoryIcon name={category.icon} className="size-4 text-brand-400" />
                <span className="underline decoration-white/30 underline-offset-4 hover:decoration-white">{category.name}</span>
                <span className="text-navy-300">{category.services?.length}</span>
              </a>
            ))}
          </nav>
        )}
      </PageHero>

      <div className="bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          {!catalogue ? (
            <Card>
              <EmptyState icon={CloudOff} title="Services are temporarily unavailable" description="Please refresh in a moment, or email hello@reenite.com." />
            </Card>
          ) : (
            <>
              {catalogue.bundles.map((bundle) => (
                <BundleBand key={bundle.id} bundle={bundle} />
              ))}

              <div>
                {categories.map((category) => (
                  <CategorySection key={category.id} category={category} />
                ))}
              </div>

              <HelpStrip />
            </>
          )}
        </div>
      </div>
    </>
  );
}

function BundleBand({ bundle }: { bundle: Bundle }) {
  const saving = (bundle.value_of_services ?? 0) - bundle.price;
  return (
    <section className="mb-16 grid gap-8 rounded-md bg-navy-950 p-8 text-white sm:p-10 lg:grid-cols-[1.2fr_1fr_auto] lg:items-center lg:gap-12">
      <div>
        <p className="font-semibold text-brand-400">Starting from scratch?</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{bundle.name}</h2>
        <p className="mt-2 leading-relaxed text-navy-200">{bundle.description ?? bundle.summary}</p>
      </div>
      <ul className="space-y-2.5 text-sm lg:border-l lg:border-white/10 lg:pl-12">
        {bundle.services?.map((service) => (
          <li key={service.id} className="flex items-baseline justify-between gap-4">
            <span>{service.name}</span>
            <span className="text-navy-300">{formatNaira(service.total_fee)}</span>
          </li>
        ))}
      </ul>
      <div className="lg:text-right">
        <p className="font-display text-3xl font-bold">{formatNaira(bundle.price)}</p>
        {saving > 0 && (
          <p className="mt-1 text-sm text-navy-200">
            <span className="line-through">{formatNaira(bundle.value_of_services ?? 0)}</span>{" "}
            <span className="font-semibold text-brand-400">Save {formatNaira(saving)}</span>
          </p>
        )}
        <ButtonLink href="/register" variant="light" className="mt-5">
          Get the pack
        </ButtonLink>
      </div>
    </section>
  );
}

function CategorySection({ category }: { category: ServiceCategory }) {
  const photo = categoryPhotos[category.slug];
  return (
    <section id={category.slug} className="grid scroll-mt-24 gap-6 py-12 first:pt-0 lg:grid-cols-[300px_1fr] lg:gap-16">
      <div className="lg:sticky lg:top-24 lg:self-start">
        {photo && (
          <div className="relative mb-6 aspect-[16/9] overflow-hidden rounded-md sm:aspect-[2/1] lg:aspect-[4/3]">
            <Image src={photo.src} alt={photo.alt} fill sizes="(min-width: 1024px) 300px, 100vw" className="object-cover" />
          </div>
        )}
        <CategoryIcon name={category.icon} className="size-7 text-brand-500" />
        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">{category.name}</h2>
        {category.description && <p className="mt-2 leading-relaxed text-muted">{category.description}</p>}
      </div>
      <ul className="border-t border-border">
        {category.services?.map((service) => (
          <ServiceRow key={service.id} service={service} />
        ))}
      </ul>
    </section>
  );
}

function ServiceRow({ service }: { service: Service }) {
  const turnaround = turnaroundLabel(service.turnaround_days);
  return (
    <li className="border-b border-border">
      <Link
        href={`/services/${service.slug}`}
        className="group grid gap-3 py-5 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-8 hover:[&_h3]:text-brand-600"
      >
        <div>
          <h3 className="font-semibold text-foreground transition-colors">{service.name}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">{service.summary}</p>
          {turnaround && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
              <Clock className="size-3.5" /> {turnaround}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between gap-4 sm:justify-end">
          <div className="sm:text-right">
            <p className="font-display text-lg font-bold text-foreground">{formatNaira(service.total_fee)}</p>
            <p className="text-xs text-muted">
              {service.government_fee > 0 ? `incl. ${formatNaira(service.government_fee)} government fees` : "No government fees"}
            </p>
          </div>
          <ChevronRight className="size-5 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
        </div>
      </Link>
    </li>
  );
}

function HelpStrip() {
  return (
    <section className="mt-12 flex flex-col gap-6 rounded-md border border-border bg-surface-muted p-8 sm:p-10 md:flex-row md:items-center md:justify-between">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Not sure what you need?</h2>
        <p className="mt-2 max-w-xl leading-relaxed text-muted">
          Tell us about your business and one of our legal experts will recommend the right registration and filings. It costs nothing to ask.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-3">
        <a href={hq.whatsapp} className={buttonClasses({ size: "lg", variant: "navy" })}>
          <MessageSquare className="size-4" /> Chat on WhatsApp
        </a>
        <a href={hq.phoneHref} className={buttonClasses({ size: "lg", variant: "outline" })}>
          Call {hq.phone}
        </a>
      </div>
    </section>
  );
}
