import type { Invoice } from "@/lib/types";
import { formatDate, formatNaira } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { InvoiceStatusBadge } from "./status-badges";

/** The invoice itself: number, dates, line items and totals. Shared by customer and admin views. */
export function InvoiceDocument({ invoice }: { invoice: Invoice }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border bg-navy-900 px-6 py-5 text-white dark:bg-navy-800">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-navy-200">Invoice</p>
          <p className="mt-1 font-display text-2xl font-extrabold">{invoice.number}</p>
        </div>
        <div className="text-right text-sm text-navy-100">
          <p>Issued {formatDate(invoice.created_at)}</p>
          {invoice.due_at && <p>Due {formatDate(invoice.due_at)}</p>}
          <div className="mt-2">
            <InvoiceStatusBadge invoice={invoice} />
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="text-xs font-semibold uppercase tracking-wider text-muted">
            <tr className="border-b border-border">
              <th className="px-6 py-3">Description</th>
              <th className="px-3 py-3 text-right">Qty</th>
              <th className="px-3 py-3 text-right">Price</th>
              <th className="px-6 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {invoice.items?.map((item) => (
              <tr key={item.id}>
                <td className="px-6 py-3.5 font-medium text-foreground">{item.description}</td>
                <td className="px-3 py-3.5 text-right text-muted">{item.quantity}</td>
                <td className="px-3 py-3.5 text-right text-muted">{formatNaira(item.unit_amount)}</td>
                <td className="px-6 py-3.5 text-right font-semibold text-foreground">{formatNaira(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="ml-auto max-w-xs space-y-2 border-t border-border px-6 py-5 text-sm">
        {invoice.coupon_code && (
          <>
            <div className="flex justify-between">
              <dt className="text-muted">Before discount</dt>
              <dd className="text-foreground">{formatNaira(invoice.total + invoice.coupon_discount)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">
                Code <span className="font-mono font-semibold text-foreground">{invoice.coupon_code}</span>
              </dt>
              <dd className="font-semibold text-success">−{formatNaira(invoice.coupon_discount)}</dd>
            </div>
          </>
        )}
        <div className="flex justify-between">
          <dt className="text-muted">Total</dt>
          <dd className="font-semibold text-foreground">{formatNaira(invoice.total)}</dd>
        </div>
        {invoice.amount_paid > 0 && (
          <div className="flex justify-between">
            <dt className="text-muted">Paid</dt>
            <dd className="font-semibold text-success">−{formatNaira(invoice.amount_paid)}</dd>
          </div>
        )}
        {invoice.amount_refunded > 0 && (
          <div className="flex justify-between">
            <dt className="text-muted">Refunded</dt>
            <dd className="font-semibold text-foreground">{formatNaira(invoice.amount_refunded)}</dd>
          </div>
        )}
        <div className="flex justify-between border-t border-border pt-2">
          <dt className="font-semibold text-foreground">Balance due</dt>
          <dd className="font-display text-xl font-extrabold text-foreground">{formatNaira(invoice.status === "void" ? 0 : invoice.balance)}</dd>
        </div>
      </dl>
      {invoice.notes && <p className="whitespace-pre-line border-t border-border px-6 py-4 text-sm text-muted">{invoice.notes}</p>}
    </Card>
  );
}
