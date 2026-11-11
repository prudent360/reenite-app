import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Building2, CalendarClock, Plus } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { ComplianceList } from "@/components/businesses/compliance-list";
import { HealthBadge, HealthIssues, HealthRing } from "@/components/businesses/health";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireCustomer } from "@/lib/session";
import type { Business, ComplianceItem } from "@/lib/types";

export const metadata: Metadata = { title: "My Businesses" };

export default function BusinessesPage() {
  return (
    <>
      <PageHeader
        title="My Businesses"
        description="Each business's health score and its filing deadlines, worked out from its details."
        actions={
          <ButtonLink href="/dashboard/businesses/new">
            <Plus className="size-4" /> Add a business
          </ButtonLink>
        }
      />
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Businesses />
      </Suspense>
    </>
  );
}

async function Businesses() {
  await requireCustomer();
  const [{ data: businesses }, { data: deadlines }] = await Promise.all([
    api<{ data: Business[] }>("/businesses"),
    api<{ data: ComplianceItem[] }>("/compliance"),
  ]);

  if (businesses.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Building2}
          title="Add your first business"
          description="Tell us what kind of business it is and which taxes it pays. We'll work out its CAC and tax deadlines, remind you before each one, and give it a health score."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <ButtonLink href="/dashboard/businesses/new">Add a business</ButtonLink>
              <ButtonLink href="/dashboard/services" variant="outline">
                Register a new one
              </ButtonLink>
            </div>
          }
        />
      </Card>
    );
  }

  // The next 60 days, plus anything overdue.
  const soon = deadlines.filter((item) => item.days_left <= 60);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2">
        {businesses.map((business) => (
          <Link
            key={business.id}
            href={`/dashboard/businesses/${business.id}`}
            className="group flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 shadow-card transition hover:border-brand-500/50"
          >
            <div className="flex items-start gap-4">
              {business.health && <HealthRing health={business.health} size="sm" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-bold text-foreground">{business.name}</p>
                <p className="text-sm text-muted">
                  {business.entity_type_label}
                  {business.registration_number ? ` · ${business.registration_number}` : ""}
                </p>
                {business.health && (
                  <div className="mt-2">
                    <HealthBadge health={business.health} />
                  </div>
                )}
              </div>
              <ArrowRight className="size-5 text-muted transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
            </div>
            {business.health && <HealthIssues health={business.health} limit={2} />}
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader title="Coming up" description="Overdue deadlines and the next 60 days, across all your businesses." />
        {soon.length === 0 ? (
          <EmptyState icon={CalendarClock} title="Nothing due in the next 60 days" description="We'll email you 14 days and 3 days before each deadline." />
        ) : (
          <ComplianceList items={soon} showBusiness={businesses.length > 1} />
        )}
      </Card>
    </div>
  );
}
