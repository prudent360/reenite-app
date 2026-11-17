"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Check, ExternalLink, Eye, FileText, Landmark, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DotLoader } from "@/components/ui/loader";
import { approveBooking, approveBookingTransfer, declineBooking, rejectBookingTransfer } from "@/lib/actions/bookings";
import { formatWhen } from "@/lib/booking-format";
import type { Booking, FormState } from "@/lib/types";
import { cn, formatDate, formatDateTime, formatNaira } from "@/lib/utils";

type Dialog = "transfer" | "decline" | null;

/** What staff can do with a booking straight from the table: view it, check a bank transfer, or approve a request. */
export function BookingRowActions({ booking, canManage, className }: { booking: Booking; canManage: boolean; className?: string }) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [pending, startTransition] = useTransition();

  function approveRequest() {
    startTransition(async () => {
      report(await approveBooking(booking.reference));
    });
  }

  return (
    <div className={cn("flex items-center justify-end gap-2", className)}>
      {canManage && booking.pending_transfer && (
        <Button size="sm" onClick={() => setDialog("transfer")}>
          <Landmark className="size-4" /> Check transfer
        </Button>
      )}
      {canManage && booking.status === "pending_approval" && (
        <>
          <Button size="sm" onClick={approveRequest} disabled={pending}>
            {pending ? <DotLoader className="text-current" label="Approving" /> : <><Check className="size-4" /> Approve</>}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDialog("decline")} disabled={pending}>
            Decline
          </Button>
        </>
      )}
      <Link href={`/admin/bookings/${booking.reference}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-semibold text-foreground hover:bg-surface-muted">
        <Eye className="size-4" /> View
      </Link>

      {dialog === "transfer" && <TransferDialog booking={booking} onClose={() => setDialog(null)} />}
      {dialog === "decline" && <DeclineDialog booking={booking} onClose={() => setDialog(null)} />}
    </div>
  );
}

function report(result: FormState): boolean {
  if (result.ok) toast.success(result.message);
  else toast.error(result.message ?? Object.values(result.errors ?? {})[0]?.[0] ?? "That didn't work.");
  return Boolean(result.ok);
}

/** A native modal dialog: opens on mount, closes on Escape, the backdrop or the X. */
function useModal() {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return ref;
}

const dialogClass = "m-auto w-[calc(100%-2rem)] max-w-2xl rounded-2xl border border-border bg-surface p-0 text-left text-foreground shadow-pop backdrop:bg-navy-950/50";
const fieldClass = "w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15";

function DialogHeader({ title, description, onClose }: { title: string; description: string; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
      <div>
        <h2 className="text-base font-bold">{title}</h2>
        <p className="mt-0.5 text-sm text-muted">{description}</p>
      </div>
      <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-surface-muted" aria-label="Close">
        <X className="size-4" />
      </button>
    </div>
  );
}

/** The receipt beside the amount and the reference to look for on the bank statement, with approve and reject. */
function TransferDialog({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const ref = useModal();
  const payment = booking.pending_transfer!;
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const proofUrl = `/files/admin/bookings/${booking.reference}/transfer-proof`;
  const isPdf = payment.proof_name?.toLowerCase().endsWith(".pdf");
  const close = () => ref.current?.close();

  function approve() {
    if (!window.confirm(`Approve ${formatNaira(payment.amount)} from ${booking.customer?.name ?? "this customer"}? Only do this once you've seen the money in the account.`)) return;
    startTransition(async () => {
      if (report(await approveBookingTransfer(booking.reference, note))) close();
    });
  }

  function reject() {
    startTransition(async () => {
      if (report(await rejectBookingTransfer(booking.reference, reason))) close();
    });
  }

  return (
    <dialog ref={ref} onClose={onClose} onClick={(event) => event.target === ref.current && close()} className={dialogClass}>
      <DialogHeader title="Check bank transfer" description="Match it against your bank statement before approving." onClose={close} />
      <div className="grid gap-5 p-5 sm:grid-cols-2">
        <div className="flex min-h-56 items-center justify-center rounded-xl bg-surface-muted p-3">
          {!payment.has_proof ? (
            <p className="text-sm text-muted">No receipt uploaded</p>
          ) : isPdf ? (
            <a href={proofUrl} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-2 text-sm font-semibold text-brand-600 hover:underline">
              <FileText className="size-10" /> Open PDF receipt
            </a>
          ) : (
            <a href={proofUrl} target="_blank" rel="noreferrer" title="Open full size">
              {/* eslint-disable-next-line @next/next/no-img-element -- private file streamed through our proxy */}
              <img src={proofUrl} alt={`Transfer receipt for ${booking.reference}`} className="max-h-72 rounded-lg object-contain" />
            </a>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <p className="font-display text-3xl font-extrabold">{formatNaira(payment.amount)}</p>
            <p className="text-sm text-muted">Submitted {formatDateTime(payment.created_at)}</p>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted">Customer</dt>
            <dd className="font-medium">{booking.customer?.name}</dd>
            <dt className="text-muted">Sender name</dt>
            <dd className="font-medium">{payment.sender_name}</dd>
            <dt className="text-muted">Transfer date</dt>
            <dd className="font-medium">{formatDate(payment.transferred_on)}</dd>
            <dt className="text-muted">Reference</dt>
            <dd className="font-mono font-semibold">{payment.invoice?.number}</dd>
            <dt className="text-muted">Booking</dt>
            <dd className="font-medium">{booking.space_name} · {formatWhen(booking)}</dd>
          </dl>
          {payment.has_proof && (
            <a href={proofUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline">
              Open receipt <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
      </div>

      <div className="space-y-3 border-t border-border px-5 py-4">
        {rejecting ? (
          <>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">Reason (sent to the customer)</span>
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} maxLength={500} autoFocus className={fieldClass} placeholder="e.g. We can't find a matching credit for this amount on that date." />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button variant="danger" onClick={reject} disabled={pending || !reason.trim()}>
                {pending ? <DotLoader className="text-current" label="Rejecting" /> : "Reject transfer"}
              </Button>
              <Button variant="ghost" onClick={() => setRejecting(false)} disabled={pending}>
                Back
              </Button>
            </div>
          </>
        ) : (
          <>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">Note <span className="font-normal text-muted">(optional, staff only)</span></span>
              <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} className={fieldClass} />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button onClick={approve} disabled={pending}>
                {pending ? <DotLoader className="text-current" label="Approving" /> : <><Check className="size-4" /> Approve, money received</>}
              </Button>
              <Button variant="outline" className="text-danger" onClick={() => setRejecting(true)} disabled={pending}>
                <X className="size-4" /> Reject
              </Button>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}

function DeclineDialog({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const ref = useModal();
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const close = () => ref.current?.close();

  function decline() {
    startTransition(async () => {
      if (report(await declineBooking(booking.reference, reason))) close();
    });
  }

  return (
    <dialog ref={ref} onClose={onClose} onClick={(event) => event.target === ref.current && close()} className={dialogClass.replace("max-w-2xl", "max-w-md")}>
      <DialogHeader title={`Decline ${booking.customer?.name ?? "this"}'s request`} description={`${booking.space_name} · ${formatWhen(booking)}`} onClose={close} />
      <div className="space-y-3 px-5 py-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Why are you declining it?</span>
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={500} autoFocus className={fieldClass} />
          <span className="block text-xs text-muted">The customer sees this in their email.</span>
        </label>
        <div className="flex gap-2">
          <Button variant="danger" onClick={decline} disabled={pending || !reason.trim()}>
            {pending ? <DotLoader className="text-current" label="Declining" /> : "Decline request"}
          </Button>
          <Button variant="ghost" onClick={close} disabled={pending}>
            Back
          </Button>
        </div>
      </div>
    </dialog>
  );
}
