import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AlertTriangle, ArrowLeft, CalendarClock, CheckCircle2, Mail, MessageCircle, Phone, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { AppointmentActions } from "@/components/admin/appointments/appointment-actions";
import { Alert, Badge, Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { ApiError, api } from "@/lib/api";
import { appointmentTone, describeHistory, formatAppointmentWhen, punctualityConcern } from "@/lib/appointment-format";
import { formatDateTime } from "@/lib/utils";
import { requireStaff } from "@/lib/session";
import type { Appointment } from "@/lib/types";

export default function AppointmentAdminPage({ params }: PageProps<"/admin/appointments/[reference]">) {
  return (
    <>
      <Link href="/admin/appointments" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Appointments
      </Link>
      <Suspense fallback={<Skeleton className="h-[560px] rounded-2xl" />}>
        {params.then(({ reference }) => (
          <Detail reference={reference} />
        ))}
      </Suspense>
    </>
  );
}

/** Which channels the client's messages actually go out on. */
function channels(client: Appointment["client"]): string {
  if (!client?.whatsapp) return "By email. They haven't agreed to WhatsApp reminders.";
  if (!client.whatsapp_live) return "By email. WhatsApp starts once WhatsApp sending is set up in Admin > Settings.";
  return "By email and WhatsApp.";
}

async function Detail({ reference }: { reference: string }) {
  await requireStaff("appointments.manage");
  let appointment: Appointment;
  try {
    ({ data: appointment } = await api<{ data: Appointment }>(`/admin/appointments/${encodeURIComponent(reference)}`));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const client = appointment.client;
  const upcoming = appointment.status === "scheduled" && new Date(appointment.ends_at) > new Date();
  const rows: [string, ReactNode][] = [
    ["When", formatAppointmentWhen(appointment)],
    ["How", appointment.mode_label],
    [appointment.mode === "video" ? "Link" : "Details", <span key="details" className="whitespace-pre-line break-words">{appointment.meeting_details}</span>],
    ["With", appointment.staff_name ?? "Anyone on the team"],
    ["Booked by", appointment.created_by ?? "Staff"],
  ];
  const reminders: [string, string | null, boolean][] = [
    ["Confirmation", appointment.created_at, true],
    ["Day before", appointment.reminded_day_at, new Date(appointment.starts_at).getTime() - new Date(appointment.created_at).getTime() >= 24 * 3600 * 1000],
    ["An hour before", appointment.reminded_hour_at, true],
  ];

  return (
    <>
      <title>{`${appointment.title} · ${client?.name ?? "Client"} | Reenite Admin`}</title>
      <PageHeader
        title={`${client?.name ?? "Client"} · ${appointment.title}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{appointment.reference}</span>
            <Badge tone={appointmentTone(appointment)}>{appointment.status_label}</Badge>
          </span>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {appointment.response === "reschedule_requested" && upcoming && (
            <Alert tone="warning" icon={RefreshCw} title="The client asked to reschedule">
              {appointment.response_note ? `"${appointment.response_note}"` : "They didn't leave a note."} Reminders are paused until you pick a new time.
            </Alert>
          )}
          {appointment.response === "confirmed" && upcoming && (
            <Alert tone="success" icon={CheckCircle2}>
              {client?.name.split(" ")[0] ?? "The client"} confirmed they&apos;ll be there{appointment.responded_at ? ` (${formatDateTime(appointment.responded_at)})` : ""}.
            </Alert>
          )}
          {appointment.status === "cancelled" && (
            <Alert tone="info" icon={CalendarClock} title="Cancelled">
              {appointment.cancel_reason}
            </Alert>
          )}

          <Card>
            <CardHeader title="Appointment" />
            <dl className="divide-y divide-border">
              {rows.map(([label, value]) => (
                <div key={label} className="grid grid-cols-[110px_1fr] gap-4 px-5 py-3 text-sm sm:px-6">
                  <dt className="text-muted">{label}</dt>
                  <dd className="text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Messages to the client" description={channels(client)} />
            <ul className="divide-y divide-border text-sm">
              {reminders.map(([label, sentAt, applies]) => (
                <li key={label} className="flex items-center justify-between gap-4 px-5 py-3 sm:px-6">
                  <span className="text-foreground">{label}</span>
                  <span className="text-muted">
                    {sentAt ? `Sent ${formatDateTime(sentAt)}` : !applies ? "Not needed (booked less than a day ahead)" : upcoming ? "Scheduled" : "Not sent"}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          {appointment.staff_notes && (
            <Card>
              <CardHeader title="Notes for staff" />
              <p className="whitespace-pre-line p-5 text-sm text-foreground sm:p-6">{appointment.staff_notes}</p>
            </Card>
          )}
        </div>

        <div className="space-y-6 lg:sticky lg:top-24">
          {client && (
            <Card>
              <CardHeader title={client.name} description={client.is_guest ? "Client without an account" : "Has a Reenite account"} />
              <div className="space-y-3 p-5 text-sm sm:p-6">
                {client.phone && (
                  <a href={`tel:${client.phone.replace(/\s/g, "")}`} className="flex items-center gap-2 font-medium text-foreground hover:text-brand-600">
                    <Phone className="size-4 text-muted" /> {client.phone}
                  </a>
                )}
                <a href={`mailto:${client.email}`} className="flex items-center gap-2 break-all font-medium text-foreground hover:text-brand-600">
                  <Mail className="size-4 shrink-0 text-muted" /> {client.email}
                </a>
                <p className="flex items-center gap-2 text-muted">
                  <MessageCircle className="size-4" /> {!client.whatsapp ? "Hasn't agreed to WhatsApp" : client.whatsapp_live ? "Gets WhatsApp reminders" : "Agreed to WhatsApp (not switched on yet)"}
                </p>
                <div className="border-t border-border pt-3">
                  <p className="text-xs font-semibold text-muted">Punctuality</p>
                  <p className="mt-1 text-foreground">{describeHistory(appointment.history) ?? "No past appointments yet."}</p>
                </div>
                {punctualityConcern(appointment.history) && (
                  <Alert tone="warning" icon={AlertTriangle}>
                    Often late or absent. A quick call the day before helps.
                  </Alert>
                )}
              </div>
            </Card>
          )}
          <AppointmentActions appointment={appointment} />
        </div>
      </div>
    </>
  );
}
