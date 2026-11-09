import type { Metadata } from "next";
import { Suspense } from "react";
import { BankTransferManager } from "@/components/admin/settings/bank-transfer-manager";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import type { BankTransferSettings } from "@/lib/types";

export const metadata: Metadata = { title: "Bank transfer" };

export default function BankTransferPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <BankTransfer />
    </Suspense>
  );
}

async function BankTransfer() {
  await requireStaff("settings.manage");
  const { bank_transfer } = await api<{ bank_transfer: BankTransferSettings }>("/admin/settings/payments");
  return <BankTransferManager key={JSON.stringify(bank_transfer)} settings={bank_transfer} />;
}
