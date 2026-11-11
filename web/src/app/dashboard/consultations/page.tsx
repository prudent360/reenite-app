import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, CalendarPlus, MessagesSquare } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { consultationTones, formatConsultationWhen } from "@/lib/consultation-format";
import { requireCustomer } from "@/lib/session";
import type { Consultation } from "@/lib/types";

export const metadata: Metadata = { title: "Consultations" };

export default function ConsultationsPage() {
  return (
    <>
      <PageHeader
        title="Consultations"
        description="Book time with a legal or tax officer, by video, phone or at our office."
        actions={
          <ButtonLink href="/dashboard/consultations/book">
            <CalendarPlus className="size-4" /> Book a consultation
          </ButtonLink>
        }
      />
      <Suspense fallback={<Skeleton className="h-80 rounded-2xl" />}>
        <Consultations />
      </Suspense>
    </>
  );
}

async function Consultations() {
  await requireCustomer();
  const { data: consultations } = await api<{ data: Consultation[] }>("/consultations");
  const upcoming = consultations.filter((item) => item.is_upcoming);
  const past = consultations.filter((item) => !item.is_upcoming).reverse();

  if (consultations.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={MessagesSquare}
          title="No consultations yet"
          description="Not sure which registration you need, or what taxes apply to you? Book a session with one of our officers."
          action={<ButtonLink href="/dashboard/consultations/book">Book a consultation</ButtonLink>}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <ConsultationList title="Upcoming" consultations={upcoming} empty="Nothing booked. Book a consultation whenever you need one." />
      {past.length > 0 && <ConsultationList title="Past and cancelled" consultations={past} />}
    </div>
  );
}

function ConsultationList({ title, consultations, empty }: { title: string; consultations: Consultation[]; empty?: string }) {
  return (
    <Card>
      <CardHeader title={title} />
      {consultations.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted sm:px-6">{empty}</p>
      ) : (
        <ul className="divide-y divide-border">
          {consultations.map((consultation) => (
            <li key={consultation.reference}>
              <Link href={`/dashboard/consultations/${consultation.reference}`} className="flex items-center gap-4 px-5 py-4 hover:bg-surface-muted/50 sm:px-6">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                    {consultation.name} <Badge tone={consultationTones[consultation.status]}>{consultation.status_label}</Badge>
                  </p>
                  <p className="mt-0.5 text-sm text-muted">
                    {formatConsultationWhen(consultation)} · {consultation.mode_label}
                  </p>
                </div>
                <ArrowRight className="size-4 shrink-0 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
