import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ClientAppointmentCard } from "@/components/appointments/client-appointment-card";
import { Skeleton } from "@/components/ui/loader";
import { ApiError, api } from "@/lib/api";
import type { ClientAppointment } from "@/lib/types";

export const metadata: Metadata = { title: "Your appointment", robots: { index: false } };

/** Opened from the link in the client's confirmation and reminders. The token stands in for an account. */
export default function ClientAppointmentPage({ params, searchParams }: PageProps<"/appointments/[reference]">) {
  return (
    <section className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-16">
      <Suspense fallback={<Skeleton className="h-[460px] rounded-2xl" />}>
        {Promise.all([params, searchParams]).then(([{ reference }, query]) => (
          <Appointment reference={reference} token={typeof query.token === "string" ? query.token : ""} />
        ))}
      </Suspense>
    </section>
  );
}

async function Appointment({ reference, token }: { reference: string; token: string }) {
  if (!token) notFound();
  let appointment: ClientAppointment;
  try {
    ({ data: appointment } = await api<{ data: ClientAppointment }>(`/appointments/${encodeURIComponent(reference)}?${new URLSearchParams({ token })}`, { anonymous: true }));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  return <ClientAppointmentCard appointment={appointment} token={token} />;
}
