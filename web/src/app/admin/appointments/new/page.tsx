import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { AppointmentForm } from "@/components/admin/appointments/appointment-form";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireStaff } from "@/lib/session";

export const metadata: Metadata = { title: "New appointment" };

export default function NewAppointmentPage() {
  return (
    <>
      <Link href="/admin/appointments" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Appointments
      </Link>
      <PageHeader title="New appointment" description="Book a client in. They're sent the details as soon as you save." />
      <Suspense fallback={<Skeleton className="h-[560px] rounded-2xl" />}>
        <Form />
      </Suspense>
    </>
  );
}

async function Form() {
  await requireStaff("appointments.manage");
  const { data: staff } = await api<{ data: { id: number; name: string }[] }>("/admin/appointments/staff");
  return <AppointmentForm staff={staff} />;
}
