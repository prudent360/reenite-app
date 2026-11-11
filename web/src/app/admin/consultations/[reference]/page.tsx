import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { ConsultationStaffPanel } from "@/components/admin/consultations/consultation-staff-panel";
import { Badge, Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { ApiError, api } from "@/lib/api";
import { consultationTones, formatConsultationWhen } from "@/lib/consultation-format";
import { requireStaff } from "@/lib/session";
import type { Consultation } from "@/lib/types";
import { formatDateTime, formatNaira } from "@/lib/utils";

export const metadata: Metadata = { title: "Consultation" };

export default function ConsultationAdminPage({ params }: PageProps<"/admin/consultations/[reference]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[480px] rounded-2xl" />}>
      {params.then(({ reference }) => (
        <ConsultationDetail reference={reference} />
      ))}
    </Suspense>
  );
}

async function ConsultationDetail({ reference }: { reference: string }) {
  await requireStaff();
  let consultation: Consultation;
  let canManage: boolean;
  let officers: { id: number; name: string }[];
  try {
    ({ data: consultation, can_manage: canManage, officers } = await api<{ data: Consultation; can_manage: boolean; officers: { id: number; name: string }[] }>(
      `/admin/consultations/${encodeURIComponent(reference)}`,
    ));
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) notFound();
    throw error;
  }
  const invoice = consultation.invoice;

  const rows: [string, React.ReactNode][] = [
    ["When", formatConsultationWhen(consultation)],
    ["How", consultation.mode_label],
    ["Customer", consultation.customer ? `${consultation.customer.name} · ${consultation.customer.email}${consultation.customer.phone ? ` · ${consultation.customer.phone}` : ""}` : "Unknown"],
    ["Topic", <span key="topic" className="whitespace-pre-line">{consultation.topic}</span>],
    ["Price", consultation.price > 0 ? formatNaira(consultation.price) : "Free"],
    ["Payment", invoice ? `Invoice ${invoice.number} · ${invoice.status === "paid" ? `paid ${formatNaira(invoice.amount_paid)}` : invoice.status}${invoice.coupon_code ? ` · code ${invoice.coupon_code}` : ""}` : "Nothing to pay"],
    ...(consultation.cancelled_at ? ([["Cancelled", `${formatDateTime(consultation.cancelled_at)}: ${consultation.cancel_reason}${consultation.refund_amount > 0 ? ` · refund ${formatNaira(consultation.refund_amount)}` : ""}`]] as [string, React.ReactNode][]) : []),
  ];

  return (
    <>
      <Link href="/admin/consultations" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Consultations
      </Link>
      <PageHeader
        title={`${consultation.name} · ${consultation.customer?.name ?? "Customer"}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{consultation.reference}</span>
            <Badge tone={consultationTones[consultation.status]}>{consultation.status_label}</Badge>
          </span>
        }
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Details" />
          <dl className="divide-y divide-border">
            {rows.map(([label, value]) => (
              <div key={label} className="grid grid-cols-[110px_1fr] gap-3 px-5 py-3 text-sm sm:px-6">
                <dt className="text-muted">{label}</dt>
                <dd className="min-w-0 break-words text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <ConsultationStaffPanel consultation={consultation} officers={officers} canManage={canManage} />
      </div>
    </>
  );
}
