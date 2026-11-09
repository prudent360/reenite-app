import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ReceiptView } from "@/components/billing/receipt-view";
import { Skeleton } from "@/components/ui/loader";
import { ApiError, api } from "@/lib/api";
import { requireCustomer } from "@/lib/session";
import type { Receipt } from "@/lib/types";

export default function ReceiptPage({ params }: PageProps<"/dashboard/billing/receipts/[reference]">) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-[640px] max-w-3xl rounded-2xl" />}>
      {params.then(({ reference }) => (
        <ReceiptContent reference={reference} />
      ))}
    </Suspense>
  );
}

async function ReceiptContent({ reference }: { reference: string }) {
  await requireCustomer();
  let receipt: Receipt;
  try {
    receipt = await api<Receipt>(`/billing/payments/${encodeURIComponent(reference)}/receipt`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  return (
    <>
      <title>{`Receipt ${receipt.payment.receipt_number} | Reenite`}</title>
      <ReceiptView receipt={receipt} />
    </>
  );
}
