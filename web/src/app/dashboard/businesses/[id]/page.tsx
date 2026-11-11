import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, CalendarCheck2, MessagesSquare, Pencil } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { ComplianceList } from "@/components/businesses/compliance-list";
import { HealthBadge, HealthIssues, HealthRing } from "@/components/businesses/health";
import { ReminderForm } from "@/components/businesses/reminder-form";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { ApiError, api } from "@/lib/api";
import { requireCustomer } from "@/lib/session";
import type { Business, ComplianceItem } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Business" };

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function BusinessPage({ params }: PageProps<"/dashboard/businesses/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[560px] rounded-2xl" />}>
      {params.then(({ id }) => (
        <BusinessDetail id={id} />
      ))}
    </Suspense>
  );
}

async function BusinessDetail({ id }: { id: string }) {
  await requireCustomer();
  let business: Business;
  let items: ComplianceItem[];
  try {
    ({ data: business, items } = await api<{ data: Business; items: ComplianceItem[] }>(`/businesses/${encodeURIComponent(id)}`));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const open = items.filter((item) => item.status === "open");
  const closed = items.filter((item) => item.status !== "open").reverse();
  const health = business.health;

  const details: [string, string][] = [
    ["Type", business.entity_type_label],
    ["CAC number", business.registration_number ?? "Not added"],
    ["Registered", business.registered_on ? formatDate(business.registered_on) : "Not added"],
    ["TIN", business.tin ?? "Not added"],
    ["VAT", business.vat_registered ? "Registered, monthly returns" : "Not registered"],
    ["PAYE", business.has_employees ? "Staff on payroll, monthly remittance" : "No staff on payroll"],
    ...(business.entity_type === "company" ? ([["Financial year ends", months[business.financial_year_end_month - 1] ?? "December"]] as [string, string][]) : []),
    ["State", business.state ?? "Not added"],
  ];

  return (
    <>
      <Link href="/dashboard/businesses" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> My Businesses
      </Link>
      <PageHeader
        title={business.name}
        description={business.entity_type_label}
        actions={
          <ButtonLink href={`/dashboard/businesses/${business.id}/edit`} variant="outline">
            <Pencil className="size-4" /> Edit details
          </ButtonLink>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Compliance calendar" description="We email you 14 days and 3 days before each deadline." action={<ReminderForm businessId={business.id} />} />
            {open.length === 0 ? (
              <EmptyState icon={CalendarCheck2} title="You're all caught up" description="Nothing is waiting to be filed. Add your own reminders for permits and renewals." />
            ) : (
              <ComplianceList items={open} />
            )}
          </Card>

          {closed.length > 0 && (
            <Card>
              <CardHeader title="Done and dismissed" description="The last 12 months." />
              <ComplianceList items={closed} />
            </Card>
          )}

          <Alert tone="info" icon={MessagesSquare} title="These dates are worked out from your details">
            They follow the usual CAC and tax rules. Your officer can confirm exact dates, or file for you. Book a{" "}
            <Link href="/dashboard/consultations/book" className="font-semibold underline">
              tax and compliance review
            </Link>{" "}
            if you&apos;re unsure what applies.
          </Alert>
        </div>

        <div className="space-y-6">
          {health && (
            <Card className="p-5 sm:p-6">
              <div className="flex items-center gap-5">
                <HealthRing health={health} />
                <div>
                  <p className="text-sm text-muted">Business health</p>
                  <div className="mt-1">
                    <HealthBadge health={health} />
                  </div>
                </div>
              </div>
              <div className="mt-5 border-t border-border pt-4">
                <HealthIssues health={health} />
              </div>
            </Card>
          )}
          <Card>
            <CardHeader title="Details" />
            <dl className="divide-y divide-border">
              {details.map(([label, value]) => (
                <div key={label} className="grid grid-cols-[130px_1fr] gap-3 px-5 py-3 text-sm sm:px-6">
                  <dt className="text-muted">{label}</dt>
                  <dd className="text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}
