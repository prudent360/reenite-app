import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Archive, Briefcase, ExternalLink, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { CategoryIcon } from "@/components/catalogue/category-icon";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { Alert, Badge, Card, EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import type { Service, ServiceCategory } from "@/lib/types";
import { formatNaira } from "@/lib/utils";

export const metadata: Metadata = { title: "Services" };

export default function AdminServicesPage({ searchParams }: PageProps<"/admin/services">) {
  return (
    <>
      <PageHeader
        title="Services"
        description="The catalogue customers order from: prices, intake forms, documents and stages."
        actions={
          <ButtonLink href="/admin/services/new">
            <Plus className="size-4" /> New service
          </ButtonLink>
        }
      />
      <Suspense fallback={<Skeleton className="h-[480px] rounded-2xl" />}>
        <ServiceTable searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ServiceTable({ searchParams }: { searchParams: PageProps<"/admin/services">["searchParams"] }) {
  await requireStaff("services.manage");
  const params = await searchParams;
  const categoryId = typeof params.category === "string" ? params.category : "";
  const status = params.status === "active" || params.status === "hidden" ? params.status : "";
  const search = typeof params.q === "string" ? params.q : "";

  const query = new URLSearchParams();
  if (categoryId) query.set("category_id", categoryId);
  if (status) query.set("status", status);
  if (search) query.set("search", search);

  const [{ data: services }, { data: categories }] = await Promise.all([
    api<{ data: Service[] }>(`/admin/services?${query}`),
    api<{ data: ServiceCategory[] }>("/admin/service-categories"),
  ]);

  return (
    <div className="space-y-4">
      {params.archived && (
        <Alert tone="success" icon={Archive}>
          Service archived. It no longer appears to customers.
        </Alert>
      )}
      <Card className="overflow-hidden">
        <form className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:p-5">
          <label className="relative flex-1">
            <span className="sr-only">Search services</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              name="q"
              defaultValue={search}
              placeholder="Search services"
              className="h-10 w-full rounded-xl border border-border bg-surface pl-10 pr-3 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
            />
          </label>
          <select name="category" defaultValue={categoryId} aria-label="Filter by category" className="h-10 rounded-xl border border-border bg-surface px-3 text-sm text-foreground">
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={status} aria-label="Filter by status" className="h-10 rounded-xl border border-border bg-surface px-3 text-sm text-foreground">
            <option value="">Any status</option>
            <option value="active">Live</option>
            <option value="hidden">Hidden</option>
          </select>
          <button type="submit" className={buttonClasses({ variant: "navy", size: "sm", className: "h-10" })}>
            Filter
          </button>
        </form>

        {services.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title={search || categoryId || status ? "No services match" : "No services yet"}
            description={search || categoryId || status ? "Try a different filter." : "Create your first service to start the catalogue."}
            action={<ButtonLink href="/admin/services/new">New service</ButtonLink>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-surface-muted text-xs font-semibold uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-3">Service</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3 text-right">Price</th>
                  <th className="px-5 py-3">Turnaround</th>
                  <th className="px-5 py-3">Setup</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {services.map((service) => {
                  const category = categories.find((item) => item.id === service.service_category_id);
                  return (
                    <tr key={service.id} className="hover:bg-surface-muted/50">
                      <td className="max-w-xs px-5 py-4">
                        <Link href={`/admin/services/${service.id}`} className="font-semibold text-foreground hover:text-brand-600">
                          {service.name}
                        </Link>
                        <p className="truncate text-xs text-muted">{service.summary}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-2 whitespace-nowrap text-muted">
                          <CategoryIcon name={category?.icon ?? "briefcase"} className="size-4" />
                          {service.category?.name}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right">
                        <p className="font-semibold text-foreground">{formatNaira(service.total_fee)}</p>
                        <p className="text-xs text-muted">
                          {service.government_fee > 0 ? `incl. ${formatNaira(service.government_fee)} gov.` : "No gov. fee"}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-muted">{service.turnaround_days ? `${service.turnaround_days} days` : "—"}</td>
                      <td className="px-5 py-4">
                        <SetupSummary service={service} />
                      </td>
                      <td className="px-5 py-4">{service.is_active && category?.is_active !== false ? <Badge tone="success">Live</Badge> : <Badge tone="neutral">Hidden</Badge>}</td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-1">
                          {service.is_active && (
                            <Link
                              href={`/services/${service.slug}`}
                              target="_blank"
                              className={buttonClasses({ variant: "ghost", size: "icon", className: "size-9" })}
                              aria-label={`View ${service.name} on the website`}
                            >
                              <ExternalLink className="size-4" />
                            </Link>
                          )}
                          <ButtonLink href={`/admin/services/${service.id}`} variant="outline" size="sm">
                            Edit
                          </ButtonLink>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/** Flags services that can't be ordered properly yet, e.g. no intake questions. */
function SetupSummary({ service }: { service: Service }) {
  const parts = [
    { count: service.form_fields_count ?? 0, label: "fields" },
    { count: service.document_requirements_count ?? 0, label: "docs" },
    { count: service.stages_count ?? 0, label: "stages" },
  ];
  return (
    <p className="flex flex-wrap gap-x-2 text-xs text-muted">
      {parts.map((part) => (
        <span key={part.label} className={part.count === 0 && part.label !== "docs" ? "font-semibold text-warning" : undefined}>
          {part.count} {part.label}
        </span>
      ))}
    </p>
  );
}
