import { Badge } from "@/components/ui/card";
import type { Invoice, Payment } from "@/lib/types";

const paymentTones: Record<Payment["status"], "success" | "warning" | "danger" | "neutral" | "info" | "brand"> = {
  pending: "info",
  success: "success",
  failed: "danger",
  abandoned: "neutral",
  awaiting_review: "warning",
  rejected: "danger",
  refunded: "neutral",
  partially_refunded: "brand",
};

export function PaymentStatusBadge({ payment }: { payment: Pick<Payment, "status" | "status_label"> }) {
  return <Badge tone={paymentTones[payment.status]}>{payment.status_label}</Badge>;
}

export function InvoiceStatusBadge({ invoice }: { invoice: Pick<Invoice, "status" | "status_label" | "is_overdue" | "has_pending_transfer"> }) {
  if (invoice.status === "unpaid" && invoice.has_pending_transfer) {
    return <Badge tone="warning">Checking transfer</Badge>;
  }
  if (invoice.status === "unpaid" && invoice.is_overdue) {
    return <Badge tone="danger">Overdue</Badge>;
  }
  return <Badge tone={invoice.status === "paid" ? "success" : invoice.status === "void" ? "neutral" : "warning"}>{invoice.status_label}</Badge>;
}
