import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, MailWarning } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { VerifyEmailBanner } from "@/components/app/verify-email-banner";
import { OrderForm } from "@/components/orders/order-form";
import { Skeleton } from "@/components/ui/loader";
import { getPublicService } from "@/lib/catalogue";
import { requireCustomer } from "@/lib/session";

export default function OrderServicePage({ params }: PageProps<"/dashboard/services/[slug]/order">) {
  return (
    <Suspense fallback={<Skeleton className="h-[560px] rounded-2xl" />}>
      {params.then(({ slug }) => (
        <OrderContent slug={slug} />
      ))}
    </Suspense>
  );
}

async function OrderContent({ slug }: { slug: string }) {
  const [user, service] = await Promise.all([requireCustomer(), getPublicService(slug)]);
  if (!service) {
    notFound();
  }

  return (
    <>
      <title>{`Order ${service.name} | Reenite`}</title>
      <Link href={`/dashboard/services/${service.slug}`} className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> {service.name}
      </Link>
      <PageHeader title={`Order: ${service.name}`} description="Step 1 of 3: your details. Then documents, then payment." />
      {user.email_verified ? (
        <OrderForm service={service} />
      ) : (
        <div className="max-w-2xl space-y-4">
          <VerifyEmailBanner email={user.email} />
          <p className="flex items-center gap-2 text-sm text-muted">
            <MailWarning className="size-4" /> Ordering opens as soon as your email is verified.
          </p>
        </div>
      )}
    </>
  );
}
