import { LogoMark } from "@/components/brand/logo";
import type { Receipt } from "@/lib/types";
import { formatDate, formatDateTime, formatNaira } from "@/lib/utils";
import { PrintButton } from "./print-button";

/** A printable receipt. "Download / Print" uses the browser's Save as PDF. */
export function ReceiptView({ receipt }: { receipt: Receipt }) {
  const { payment, invoice, customer, issuer } = receipt;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>
      <article className="overflow-hidden rounded-2xl border border-border bg-white text-[#1a2142] shadow-card print:border-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-[#e3e6ef] p-8">
          <div className="flex items-center gap-3">
            <LogoMark className="size-10" dotClassName="fill-[#1a2142]" />
            <div>
              <p className="font-display text-xl font-extrabold">{issuer.name}</p>
              <p className="text-sm text-[#5c6488]">{issuer.address}</p>
              <p className="text-sm text-[#5c6488]">{issuer.email}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#5c6488]">Receipt</p>
            <p className="font-display text-2xl font-extrabold">{payment.receipt_number}</p>
            <p className="mt-1 text-sm text-[#5c6488]">{formatDateTime(payment.paid_at)}</p>
          </div>
        </header>

        <section className="grid gap-6 border-b border-[#e3e6ef] p-8 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#5c6488]">Received from</p>
            <p className="mt-1 font-semibold">{customer.name}</p>
            <p className="text-sm text-[#5c6488]">{customer.email}</p>
            {customer.phone && <p className="text-sm text-[#5c6488]">{customer.phone}</p>}
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:text-right">
            <dt className="text-[#5c6488]">Invoice</dt>
            <dd className="font-semibold">{invoice.number}</dd>
            <dt className="text-[#5c6488]">Invoice date</dt>
            <dd>{formatDate(invoice.created_at)}</dd>
            <dt className="text-[#5c6488]">Paid by</dt>
            <dd>{payment.gateway_label}{payment.channel && payment.channel !== "bank_transfer" ? ` (${payment.channel})` : ""}</dd>
            <dt className="text-[#5c6488]">Reference</dt>
            <dd className="font-mono text-xs leading-5">{payment.reference}</dd>
          </dl>
        </section>

        <table className="w-full text-left text-sm">
          <thead className="text-xs font-semibold uppercase tracking-wider text-[#5c6488]">
            <tr className="border-b border-[#e3e6ef]">
              <th className="px-8 py-3">Description</th>
              <th className="px-3 py-3 text-right">Qty</th>
              <th className="px-8 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items?.map((item) => (
              <tr key={item.id} className="border-b border-[#e3e6ef]">
                <td className="px-8 py-3">{item.description}</td>
                <td className="px-3 py-3 text-right">{item.quantity}</td>
                <td className="px-8 py-3 text-right">{formatNaira(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="ml-auto max-w-xs space-y-2 p-8 text-sm">
          <div className="flex justify-between">
            <dt className="text-[#5c6488]">Invoice total</dt>
            <dd>{formatNaira(invoice.total)}</dd>
          </div>
          <div className="flex justify-between border-t border-[#e3e6ef] pt-2 text-base">
            <dt className="font-semibold">Amount paid</dt>
            <dd className="font-display text-xl font-extrabold">{formatNaira(payment.amount)}</dd>
          </div>
          {payment.amount_refunded > 0 && (
            <div className="flex justify-between">
              <dt className="text-[#5c6488]">Refunded</dt>
              <dd>−{formatNaira(payment.amount_refunded)}</dd>
            </div>
          )}
        </dl>

        <footer className="bg-[#f6f7fb] px-8 py-5 text-center text-xs text-[#5c6488]">
          Thank you for your business. Building a business? Don&apos;t build alone.
        </footer>
      </article>
    </div>
  );
}
