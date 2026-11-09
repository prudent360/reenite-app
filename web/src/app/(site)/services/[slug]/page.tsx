import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronRight, Clock, CloudOff, Landmark, MessageSquare } from "lucide-react";
import { ServiceDetail, turnaroundLabel } from "@/components/catalogue/service-display";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { hq } from "@/content/site";
import { getCatalogue, getPublicService } from "@/lib/catalogue";
import { categoryPhotos } from "@/lib/category-photos";
import type { Service } from "@/lib/types";
import { formatNaira } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/services/[slug]">) {
  const service = await getPublicService((await params).slug);
  return service ? { title: service.name, description: service.summary } : { title: "Service" };
}

export default function PublicServicePage({ params }: PageProps<"/services/[slug]">) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      {params.then(({ slug }) => (
        <ServiceContent slug={slug} />
      ))}
    </Suspense>
  );
}

async function ServiceContent({ slug }: { slug: string }) {
  const [service, catalogue] = await Promise.all([getPublicService(slug), getCatalogue()]);

  if (service === undefined) {
    notFound();
  }

  const category = catalogue?.categories.find((item) => item.id === service?.service_category_id || item.slug === service?.category?.slug);
  const related = (category?.services ?? []).filter((item) => item.slug !== slug);
  const photo = category ? categoryPhotos[category.slug] : undefined;

  return (
    <>
      <section className="bg-navy-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-16 lg:px-8">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-navy-200">
            <Link href="/services" className="hover:text-white">
              Services
            </Link>
            {category && (
              <>
                <ChevronRight className="size-3.5" />
                <Link href={`/services#${category.slug}`} className="hover:text-white">
                  {category.name}
                </Link>
              </>
            )}
          </nav>

          {service && (
            <div className={photo ? "mt-6 grid items-center gap-10 lg:grid-cols-[1.25fr_1fr] lg:gap-14" : "mt-6"}>
              <div>
                <h1 className="max-w-3xl text-4xl font-bold leading-[1.1] sm:text-5xl">{service.name}</h1>
                <p className="mt-4 max-w-2xl text-lg leading-relaxed text-navy-100">{service.summary}</p>
                <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-5">
                  <div>
                    <dt className="text-sm text-navy-200">Total price</dt>
                    <dd className="mt-1 font-display text-2xl font-bold">{formatNaira(service.total_fee)}</dd>
                  </div>
                  {service.turnaround_days && (
                    <div>
                      <dt className="flex items-center gap-1.5 text-sm text-navy-200">
                        <Clock className="size-4 text-brand-400" /> Turnaround
                      </dt>
                      <dd className="mt-1 text-lg font-semibold">{turnaroundLabel(service.turnaround_days)}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="flex items-center gap-1.5 text-sm text-navy-200">
                      <Landmark className="size-4 text-brand-400" /> Government fees
                    </dt>
                    <dd className="mt-1 text-lg font-semibold">{service.government_fee > 0 ? `${formatNaira(service.government_fee)} included` : "None"}</dd>
                  </div>
                </dl>
                <div className="mt-8 flex flex-wrap gap-3">
                  <ButtonLink href="/register" size="lg" variant="light">
                    Get started
                  </ButtonLink>
                  <a href={hq.whatsapp} className={buttonClasses({ size: "lg", variant: "glass" })}>
                    Ask a question
                  </a>
                </div>
              </div>
              {photo && (
                <div className="relative aspect-[4/3] overflow-hidden rounded-md">
                  <Image src={photo.src} alt={photo.alt} fill priority sizes="(min-width: 1024px) 520px, 100vw" className="object-cover" />
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {service ? (
          <ServiceDetail
            service={service}
            cta={
              <div className="space-y-2">
                <ButtonLink href="/register" size="lg" className="w-full">
                  Get started
                </ButtonLink>
                <ButtonLink href={`/login?next=/dashboard/services/${service.slug}`} variant="outline" className="w-full">
                  I already have an account
                </ButtonLink>
              </div>
            }
          />
        ) : (
          <Card>
            <EmptyState icon={CloudOff} title="This service couldn't be loaded" description="Please refresh in a moment." />
          </Card>
        )}

        {category && related.length > 0 && (
          <section className="mt-16">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">More in {category.name}</h2>
              <Link href="/services" className="text-sm font-semibold text-brand-600 hover:underline">
                See all services
              </Link>
            </div>
            <ul className="mt-6 border-t border-border">
              {related.map((item) => (
                <RelatedRow key={item.id} service={item} />
              ))}
            </ul>
          </section>
        )}

        <section className="mt-16 flex flex-col gap-6 rounded-md border border-border bg-surface-muted p-8 sm:p-10 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Have a question first?</h2>
            <p className="mt-2 max-w-xl leading-relaxed text-muted">Our legal experts can tell you exactly what you need before you pay anything.</p>
          </div>
          <a href={hq.whatsapp} className={buttonClasses({ size: "lg", variant: "navy", className: "shrink-0" })}>
            <MessageSquare className="size-4" /> Chat on WhatsApp
          </a>
        </section>
      </div>
    </>
  );
}

function RelatedRow({ service }: { service: Service }) {
  return (
    <li className="border-b border-border">
      <Link href={`/services/${service.slug}`} className="group flex items-center justify-between gap-6 py-5 hover:[&_h3]:text-brand-600">
        <div>
          <h3 className="font-semibold text-foreground transition-colors">{service.name}</h3>
          <p className="mt-1 text-sm text-muted">{service.summary}</p>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <p className="font-display text-lg font-bold text-foreground">{formatNaira(service.total_fee)}</p>
          <ChevronRight className="size-5 text-muted transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
        </div>
      </Link>
    </li>
  );
}

function DetailSkeleton() {
  return (
    <>
      <div className="h-80 bg-navy-950" />
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
        <Skeleton className="h-96 rounded-md" />
        <Skeleton className="h-80 rounded-md" />
      </div>
    </>
  );
}
