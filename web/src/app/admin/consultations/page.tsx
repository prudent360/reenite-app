import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, MessagesSquare, Search } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { ConsultationTypeManager } from "@/components/admin/consultations/consultation-type-manager";
import { buttonClasses } from "@/components/ui/button";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { consultationTones, formatConsultationWhen } from "@/lib/consultation-format";
import { can, requireStaff } from "@/lib/session";
import type { Consultation, ConsultationType, Paginated } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Consultations" };

const tabs = [
  { key: "upcoming", label: "Upcoming" },
  { key: "awaiting_payment", label: "Awaiting payment" },
  { key: "past", label: "Past" },
  { key: "cancelled", label: "Cancelled" },
  { key: "types", label: "Set up", manageOnly: true },
] as const;

type Tab = (typeof tabs)[number]["key"];

export default function ConsultationsAdminPage({ searchParams }: PageProps<"/admin/consultations">) {
  return (
    <>
      <PageHeader title="Consultations" description="Sessions customers booked with an officer." />
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        {searchParams.then((query) => {
          const tab = tabs.some((option) => option.key === query.view) ? (query.view as Tab) : "upcoming";
          return <ConsultationsView tab={tab} search={typeof query.q === "string" ? query.q : ""} />;
        })}
      </Suspense>
    </>
  );
}

async function ConsultationsView({ tab, search }: { tab: Tab; search: string }) {
  const user = await requireStaff();
  const manager = can(user, "consultations.manage");
  if (!manager && !can(user, "consultations.view_assigned")) await requireStaff("consultations.manage");

  const nav = (
    <nav aria-label="Consultation sections" className="-mx-1 mb-6 flex gap-1 overflow-x-auto border-b border-border px-1">
      {tabs
        .filter((option) => !("manageOnly" in option) || manager)
        .map((option) => (
          <Link
            key={option.key}
            href={`/admin/consultations?view=${option.key}`}
            aria-current={tab === option.key ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-3 text-sm font-semibold transition-colors",
              tab === option.key ? "border-brand-500 text-foreground" : "border-transparent text-muted hover:text-foreground",
            )}
          >
            {option.label}
          </Link>
        ))}
    </nav>
  );

  if (tab === "types" && manager) {
    const { data: types } = await api<{ data: ConsultationType[] }>("/admin/consultations/types");
    return (
      <>
        {nav}
        <ConsultationTypeManager types={types} />
      </>
    );
  }

  const query = new URLSearchParams({ filter: tab === "types" ? "upcoming" : tab });
  if (search) query.set("search", search);
  const { data: consultations } = await api<Paginated<Consultation>>(`/admin/consultations?${query}`);

  return (
    <>
      {nav}
      <Card className="overflow-hidden">
        <form className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:p-5">
          <input type="hidden" name="view" value={tab} />
          <label className="relative flex-1">
            <span className="sr-only">Search consultations</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              name="q"
              defaultValue={search}
              placeholder="Reference, customer or topic"
              className="h-10 w-full rounded-xl border border-border bg-surface pl-10 pr-3 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
            />
          </label>
          <button type="submit" className={buttonClasses({ variant: "navy", size: "sm", className: "h-10" })}>
            Search
          </button>
        </form>
        {consultations.length === 0 ? (
          <EmptyState
            icon={MessagesSquare}
            title={search ? "Nothing matches" : "No consultations here"}
            description={manager ? "Customers book from their dashboard under Consultations." : "Consultations assigned to you appear here."}
          />
        ) : (
          <ul className="divide-y divide-border">
            {consultations.map((consultation) => (
              <li key={consultation.reference}>
                <Link href={`/admin/consultations/${consultation.reference}`} className="flex items-center gap-4 px-5 py-4 hover:bg-surface-muted/50 sm:px-6">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">{consultation.customer?.name ?? "Customer"}</span>
                      <span className="text-sm text-muted">{consultation.name}</span>
                      <Badge tone={consultationTones[consultation.status]}>{consultation.status_label}</Badge>
                    </p>
                    <p className="mt-0.5 text-sm text-muted">
                      {formatConsultationWhen(consultation)} · {consultation.mode_label} · {consultation.officer ? consultation.officer.name : <span className="font-medium text-warning">No officer yet</span>}
                    </p>
                    <p className="truncate text-sm text-muted">{consultation.topic}</p>
                  </div>
                  <span className="hidden font-mono text-sm text-muted sm:block">{consultation.reference}</span>
                  <ChevronRight className="size-4 shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
