import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, CloudOff } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { ServiceDetail } from "@/components/catalogue/service-display";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { getPublicService } from "@/lib/catalogue";

export default function CustomerServicePage({ params }: PageProps<"/dashboard/services/[slug]">) {
  return (
    <>
      <Link href="/dashboard/services" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> All services
      </Link>
      <Suspense fallback={<Skeleton className="h-[480px] rounded-2xl" />}>
        {params.then(({ slug }) => (
          <ServiceContent slug={slug} />
        ))}
      </Suspense>
    </>
  );
}

async function ServiceContent({ slug }: { slug: string }) {
  const service = await getPublicService(slug);

  if (service === undefined) {
    notFound();
  }
  if (service === null) {
    return (
      <Card>
        <EmptyState icon={CloudOff} title="This service couldn't be loaded" description="Please refresh in a moment." />
      </Card>
    );
  }

  return (
    <>
      <title>{`${service.name} | Reenite`}</title>
      <PageHeader title={service.name} description={service.summary} />
      <ServiceDetail
        service={service}
        cta={
          <ButtonLink href={`/dashboard/services/${service.slug}/order`} size="lg" className="w-full">
            Order this service
          </ButtonLink>
        }
      />
    </>
  );
}
