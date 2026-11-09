import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { OrderStatusBadge, ProgressBar } from "@/components/orders/order-parts";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireCustomer } from "@/lib/session";
import type { Order, Paginated } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Orders" };

export default function OrdersPage() {
  return (
    <>
      <PageHeader title="Orders" description="Track every service you've ordered." actions={<ButtonLink href="/dashboard/services">New order</ButtonLink>} />
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <OrderList />
      </Suspense>
    </>
  );
}

function nextStep(order: Order): string | null {
  if (order.status === "awaiting_payment") return "Payment needed";
  if (order.status === "awaiting_client") return "Your officer needs something from you";
  if ((order.outstanding_documents ?? 0) > 0 && order.status !== "completed" && order.status !== "cancelled") return `${order.outstanding_documents} document(s) to upload`;
  return null;
}

async function OrderList() {
  await requireCustomer();
  const { data: orders } = await api<Paginated<Order>>("/orders");

  if (orders.length === 0) {
    return (
      <Card>
        <EmptyState icon={ClipboardList} title="No orders yet" description="When you order a service, you'll follow every step here." action={<ButtonLink href="/dashboard/services">Browse services</ButtonLink>} className="py-20" />
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {orders.map((order) => {
        const step = nextStep(order);
        return (
          <Link key={order.reference} href={`/dashboard/orders/${order.reference}`} className="group rounded-2xl border border-border bg-surface p-5 shadow-card transition hover:border-brand-500/50">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-xs text-muted">{order.reference}</p>
                <p className="mt-1 truncate font-bold text-foreground">{order.service.name}</p>
              </div>
              <OrderStatusBadge order={order} />
            </div>
            <div className="mt-4"><ProgressBar value={order.progress} /></div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className={step ? "font-semibold text-brand-600" : "text-muted"}>
                {step ?? (order.status === "completed" ? `Completed ${formatDate(order.completed_at)}` : order.stages.find((stage) => stage.state === "current")?.name ?? order.status_label)}
              </span>
              <ArrowRight className="size-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
