import type { Metadata } from "next";
import { CloudOff } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { CategoryIcon } from "@/components/catalogue/category-icon";
import { BundleCard, ServiceCard } from "@/components/catalogue/service-display";
import { Card, EmptyState } from "@/components/ui/card";
import { getCatalogue } from "@/lib/catalogue";

export const metadata: Metadata = { title: "Services" };

export default async function CustomerServicesPage() {
  const catalogue = await getCatalogue();

  return (
    <>
      <PageHeader title="Services" description="Everything Reenite can do for your business, with transparent prices." />

      {!catalogue ? (
        <Card>
          <EmptyState icon={CloudOff} title="Services are temporarily unavailable" description="Please refresh in a moment." />
        </Card>
      ) : (
        <div className="space-y-10">
          {catalogue.categories.length > 1 && (
            <nav aria-label="Service categories" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {catalogue.categories.map((category) => (
                <a
                  key={category.id}
                  href={`#${category.slug}`}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition hover:border-brand-500/50"
                >
                  <CategoryIcon name={category.icon} className="size-4 text-brand-500" />
                  {category.name}
                </a>
              ))}
            </nav>
          )}

          {catalogue.bundles.map((bundle) => (
            <BundleCard key={bundle.id} bundle={bundle} />
          ))}

          {catalogue.categories.map((category) => (
            <section key={category.id} id={category.slug} className="scroll-mt-24">
              <h2 className="flex items-center gap-2.5 text-xl font-bold text-foreground">
                <CategoryIcon name={category.icon} className="size-5 text-brand-500" />
                {category.name}
              </h2>
              {category.description && <p className="mt-1 text-sm text-muted">{category.description}</p>}
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {category.services?.map((service) => (
                  <ServiceCard key={service.id} service={service} href={`/dashboard/services/${service.slug}`} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
