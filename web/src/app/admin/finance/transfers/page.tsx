import type { Metadata } from "next";
import { Suspense } from "react";
import { Landmark } from "lucide-react";
import { TransferReview } from "@/components/admin/finance/transfer-review";
import { PageHeader } from "@/components/app/page-header";
import { Card, EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import type { Paginated, Payment } from "@/lib/types";

export const metadata: Metadata = { title: "Transfers to review" };

export default function TransfersPage() {
  return (
    <>
      <PageHeader title="Transfers to review" description="Check each one against your bank statement before approving. Approving sends the customer a receipt." />
      <Suspense fallback={<Skeleton className="h-80 rounded-2xl" />}>
        <Queue />
      </Suspense>
    </>
  );
}

async function Queue() {
  await requireStaff("payments.verify");
  const { data: payments } = await api<Paginated<Payment>>("/admin/finance/payments?status=awaiting_review");

  if (payments.length === 0) {
    return (
      <Card>
        <EmptyState icon={Landmark} title="All caught up" description="No bank transfers are waiting for review." />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {payments.map((payment) => (
        <TransferReview key={payment.reference} payment={payment} />
      ))}
    </div>
  );
}
