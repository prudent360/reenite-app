import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, CircleDot, ExternalLink, FileText, ListChecks, PartyPopper, Settings2, type LucideIcon } from "lucide-react";
import { ArchiveServiceButton } from "@/components/admin/catalogue/archive-service-button";
import { FormBuilder, type FieldTypeOption } from "@/components/admin/catalogue/form-builder";
import { ServiceDetailsForm } from "@/components/admin/catalogue/service-details-form";
import { RequirementsEditor, StagesEditor } from "@/components/admin/catalogue/simple-list-editors";
import { buttonClasses } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { ApiError, api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import type { Service, ServiceCategory } from "@/lib/types";
import { cn, formatNaira } from "@/lib/utils";

const tabs: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "details", label: "Details & pricing", icon: Settings2 },
  { id: "form", label: "Intake form", icon: ListChecks },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "stages", label: "Stages", icon: CircleDot },
];

export default function EditServicePage({ params, searchParams }: PageProps<"/admin/services/[id]">) {
  return (
    <>
      <Link href="/admin/services" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Services
      </Link>
      <Suspense fallback={<EditorSkeleton />}>
        <Editor params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Editor({ params, searchParams }: Pick<PageProps<"/admin/services/[id]">, "params" | "searchParams">) {
  await requireStaff("services.manage");
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const tab = tabs.some((item) => item.id === query.tab) ? (query.tab as string) : "details";

  let service: Service;
  try {
    ({ data: service } = await api<{ data: Service }>(`/admin/services/${Number(id) || 0}`));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  return (
    <>
      <title>{`${service.name} | Reenite Admin`}</title>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold text-foreground sm:text-3xl">{service.name}</h1>
            {service.is_active ? <Badge tone="success">Live</Badge> : <Badge tone="neutral">Hidden</Badge>}
          </div>
          <p className="mt-1.5 text-muted">
            {service.category?.name} · {formatNaira(service.total_fee)}
            {service.turnaround_days ? ` · ${service.turnaround_days} days` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {service.is_active && (
            <Link href={`/services/${service.slug}`} target="_blank" className={buttonClasses({ variant: "outline", size: "sm" })}>
              <ExternalLink className="size-4" /> View on website
            </Link>
          )}
          <ArchiveServiceButton serviceId={service.id} name={service.name} />
        </div>
      </div>

      {query.created && (
        <Alert tone="success" icon={PartyPopper} title="Service created" className="mb-6">
          Now add the questions customers answer when they order. When it&apos;s ready, switch it to Live under Details.
        </Alert>
      )}

      <nav aria-label="Service sections" className="-mx-1 mb-6 flex gap-1 overflow-x-auto border-b border-border px-1">
        {tabs.map((item) => {
          const count =
            item.id === "form" ? service.form_fields?.length : item.id === "documents" ? service.document_requirements?.length : item.id === "stages" ? service.stages?.length : undefined;
          return (
            <Link
              key={item.id}
              href={`/admin/services/${service.id}?tab=${item.id}`}
              aria-current={tab === item.id ? "page" : undefined}
              className={cn(
                "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition-colors",
                tab === item.id ? "border-brand-500 text-foreground" : "border-transparent text-muted hover:text-foreground",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
              {count !== undefined && <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-muted">{count}</span>}
            </Link>
          );
        })}
      </nav>

      {tab === "details" && <DetailsTab service={service} />}
      {tab === "form" && <FormTab service={service} />}
      {tab === "documents" && <RequirementsEditor key={service.updated_at} serviceId={service.id} initial={service.document_requirements ?? []} />}
      {tab === "stages" && <StagesEditor key={service.updated_at} serviceId={service.id} initial={service.stages ?? []} />}
    </>
  );
}

async function DetailsTab({ service }: { service: Service }) {
  const { data: categories } = await api<{ data: ServiceCategory[] }>("/admin/service-categories");
  return <ServiceDetailsForm service={service} categories={categories} />;
}

async function FormTab({ service }: { service: Service }) {
  const { data: fieldTypes } = await api<{ data: FieldTypeOption[] }>("/admin/meta/field-types");
  return <FormBuilder serviceId={service.id} initial={service.form_fields ?? []} fieldTypes={fieldTypes} />;
}

function EditorSkeleton() {
  return (
    <div aria-busy>
      <Skeleton className="h-9 w-80" />
      <Skeleton className="mt-3 h-5 w-56" />
      <Skeleton className="mt-8 h-11 w-full max-w-xl" />
      <Skeleton className="mt-6 h-[480px] rounded-2xl" />
    </div>
  );
}
