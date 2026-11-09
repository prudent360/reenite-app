import type { Metadata } from "next";
import { Suspense } from "react";
import { Info } from "lucide-react";
import { GatewayCard } from "@/components/admin/settings/gateway-card";
import { Alert } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import type { BankTransferSettings, PaymentGateway } from "@/lib/types";

export const metadata: Metadata = { title: "Payment gateways" };

export default function PaymentGatewaysPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[640px] rounded-2xl" />}>
      <Gateways />
    </Suspense>
  );
}

async function Gateways() {
  await requireStaff("settings.manage");
  const { gateways } = await api<{ gateways: PaymentGateway[]; bank_transfer: BankTransferSettings }>("/admin/settings/payments");
  const anyOn = gateways.some((gateway) => gateway.is_enabled);

  return (
    <div className="space-y-6">
      <Alert tone="info" icon={Info} title={anyOn ? "Customers will see the gateways switched on below" : "No online payment gateway is on yet"}>
        Paste your keys, save, then use <strong>Test connection</strong> to check them with the gateway. Start in test mode; switch to live
        mode when you&apos;re ready to take real payments.
      </Alert>
      {gateways.map((gateway) => (
        <GatewayCard key={`${gateway.code}-${gateway.updated_at}`} gateway={gateway} />
      ))}
    </div>
  );
}
