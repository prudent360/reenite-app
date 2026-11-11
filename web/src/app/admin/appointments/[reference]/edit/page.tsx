import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { AppointmentForm } from "@/components/admin/appointments/appointment-form";
import { Skeleton } from "@/components/ui/loader";
import { ApiError, api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import type { Appointment } from "@/lib/types";

export default function EditAppointmentPage({ params }: PageProps<"/admin/appointments/[reference]/edit">) {
  return (
    <Suspense fallback={<Skeleton className="h-[560px] rounded-2xl" />}>
      {params.then(({ reference }) => (
        <Editor reference={reference} />
      ))}
    </Suspense>
  );
}

async function Editor({ reference }: { reference: string }) {
  await requireStaff("appointments.manage");
  let appointment: Appointment;
  let staff: { id: number; name: string }[];
  try {
    [{ data: appointment }, { data: staff }] = await Promise.all([
      api<{ data: Appointment }>(`/admin/appointments/${encodeURIComponent(reference)}`),
      api<{ data: { id: number; name: string }[] }>("/admin/appointments/staff"),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  // Only upcoming appointments can be changed.
  if (appointment.status !== "scheduled" || new Date(appointment.starts_at) <= new Date()) redirect(`/admin/appointments/${reference}`);

  return (
    <>
      <title>{`Change ${appointment.reference} | Reenite Admin`}</title>
      <Link href={`/admin/appointments/${reference}`} className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> {appointment.reference}
      </Link>
      <PageHeader title={`Change appointment with ${appointment.client?.name ?? "client"}`} />
      <AppointmentForm staff={staff} appointment={appointment} />
    </>
  );
}
