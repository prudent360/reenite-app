import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Clock, Video } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PayPanel } from "@/components/billing/pay-panel";
import { HoldCountdown } from "@/components/booking/hold-countdown";
import { CancelConsultation } from "@/components/consultations/cancel-consultation";
import { Alert, Badge, Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { ApiError, api } from "@/lib/api";
import { consultationTones, formatConsultationWhen } from "@/lib/consultation-format";
import { requireCustomer } from "@/lib/session";
import type { Consultation, PaymentOptions } from "@/lib/types";
import { formatNaira } from "@/lib/utils";

export const metadata: Metadata = { title: "Consultation" };

export default function ConsultationPage({ params }: PageProps<"/dashboard/consultations/[reference]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[480px] rounded-2xl" />}>
      {params.then(({ reference }) => (
        <ConsultationDetail reference={reference} />
      ))}
    </Suspense>
  );
}

async function ConsultationDetail({ reference }: { reference: string }) {
  await requireCustomer();
  let consultation: Consultation;
  try {
    ({ data: consultation } = await api<{ data: Consultation }>(`/consultations/${encodeURIComponent(reference)}`));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const invoice = consultation.invoice;
  const awaitingPayment = consultation.hold_active;
  const options = awaitingPayment && invoice?.is_payable && !invoice.has_pending_transfer ? await api<PaymentOptions>("/billing/options") : null;

  const rows: [string, React.ReactNode][] = [
    ["When", formatConsultationWhen(consultation)],
    ["How", consultation.mode_label],
    ["Officer", consultation.officer?.name ?? (consultation.status === "confirmed" ? "We'll assign one before the session" : "None yet")],
    ["Topic", <span key="topic" className="whitespace-pre-line">{consultation.topic}</span>],
    ["Price", consultation.price > 0 ? formatNaira(consultation.price) : "Free"],
    ...(invoice?.coupon_code ? ([["You pay", `${formatNaira(invoice.total)} (code ${invoice.coupon_code})`]] as [string, React.ReactNode][]) : []),
  ];

  return (
    <>
      <Link href="/dashboard/consultations" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Consultations
      </Link>
      <PageHeader
        title={consultation.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{consultation.reference}</span>
            <Badge tone={consultationTones[consultation.status]}>{consultation.status_label}</Badge>
          </span>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {awaitingPayment && consultation.hold_expires_at && (
            <Alert tone="warning" icon={Clock} title="Pay to confirm your time">
              We&apos;re holding it for <HoldCountdown until={consultation.hold_expires_at} />. After that, it&apos;s released.
            </Alert>
          )}
          {consultation.status === "expired" && (
            <Alert tone="info" icon={Clock} title="This time was released">
              It wasn&apos;t paid for within 30 minutes.{" "}
              <Link href="/dashboard/consultations/book" className="font-semibold underline">
                Book another time
              </Link>
              .
            </Alert>
          )}
          {consultation.meeting_details && (consultation.status === "confirmed" || consultation.status === "completed") && (
            <Alert tone="success" icon={Video} title="How to join">
              <span className="whitespace-pre-line">{consultation.meeting_details}</span>
            </Alert>
          )}
          <Card>
            <CardHeader title="Details" />
            <dl className="divide-y divide-border">
              {rows.map(([label, value]) => (
                <div key={label} className="grid grid-cols-[110px_1fr] gap-3 px-5 py-3 text-sm sm:px-6">
                  <dt className="text-muted">{label}</dt>
                  <dd className="text-foreground">{value}</dd>
                </div>
              ))}
              {consultation.cancelled_at && (
                <div className="grid grid-cols-[110px_1fr] gap-3 px-5 py-3 text-sm sm:px-6">
                  <dt className="text-muted">Cancelled</dt>
                  <dd className="text-foreground">
                    {consultation.cancel_reason}
                    {consultation.refund_amount > 0 && <span className="block text-success">Refund {formatNaira(consultation.refund_amount)}</span>}
                  </dd>
                </div>
              )}
            </dl>
          </Card>
          {consultation.can_cancel && <CancelConsultation consultation={consultation} />}
        </div>

        <div className="space-y-6">{options && invoice && <PayPanel invoice={invoice} options={options} title="Pay for your consultation" />}</div>
      </div>
    </>
  );
}
