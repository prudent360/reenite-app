import type { Metadata } from "next";
import { Suspense } from "react";
import { MessagesSquare } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { ConsultationBooker } from "@/components/consultations/consultation-booker";
import { Card, EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireCustomer } from "@/lib/session";
import type { ConsultationType } from "@/lib/types";

export const metadata: Metadata = { title: "Book a consultation" };

export default function BookConsultationPage({ searchParams }: PageProps<"/dashboard/consultations/book">) {
  return (
    <>
      <PageHeader title="Book a consultation" description="Choose a session, pick a time that suits you, and tell us what you'd like to discuss." />
      <Suspense fallback={<Skeleton className="h-[480px] rounded-2xl" />}>
        {searchParams.then((query) => (
          <Booker type={typeof query.type === "string" ? query.type : undefined} />
        ))}
      </Suspense>
    </>
  );
}

async function Booker({ type }: { type?: string }) {
  await requireCustomer();
  const { data: types } = await api<{ data: ConsultationType[] }>("/consultations/types");

  if (types.length === 0) {
    return (
      <Card>
        <EmptyState icon={MessagesSquare} title="No consultations available right now" description="Message us and we'll arrange a time with an officer." />
      </Card>
    );
  }

  return <ConsultationBooker types={types} initialSlug={type} />;
}
