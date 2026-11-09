"use client";

import { useState, useTransition } from "react";
import { Check, ExternalLink, FileText, X } from "lucide-react";
import { toast } from "sonner";
import { approveTransfer, rejectTransfer } from "@/lib/actions/finance";
import type { Payment } from "@/lib/types";
import { formatDate, formatDateTime, formatNaira } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DotLoader } from "@/components/ui/loader";
import { TextareaField } from "@/components/ui/form";

/** One transfer to check: the proof beside the amount and reference to match against the bank statement. */
export function TransferReview({ payment }: { payment: Payment }) {
  const [mode, setMode] = useState<"idle" | "rejecting">("idle");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const proofUrl = `/files/admin/payments/${payment.reference}/proof`;
  const isPdf = payment.proof_name?.toLowerCase().endsWith(".pdf");

  function approve() {
    if (!window.confirm(`Approve ${formatNaira(payment.amount)} from ${payment.customer?.name}? Only do this once you've seen the money in the account.`)) return;
    startTransition(async () => {
      const result = await approveTransfer(payment.reference, note);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message ?? "Couldn't approve.");
    });
  }

  function reject() {
    startTransition(async () => {
      const result = await rejectTransfer(payment.reference, reason);
      if (result.ok) toast.success(result.message);
      else toast.error(result.errors?.reason?.[0] ?? result.message ?? "Couldn't reject.");
    });
  }

  return (
    <Card className="grid overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex min-h-64 items-center justify-center bg-surface-muted p-4">
        {payment.has_proof ? (
          isPdf ? (
            <a href={proofUrl} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-2 text-sm font-semibold text-brand-600 hover:underline">
              <FileText className="size-10" /> Open PDF proof
            </a>
          ) : (
            <a href={proofUrl} target="_blank" rel="noreferrer" title="Open full size">
              {/* eslint-disable-next-line @next/next/no-img-element -- private file streamed through our proxy */}
              <img src={proofUrl} alt={`Transfer proof for ${payment.reference}`} className="max-h-80 rounded-lg object-contain shadow-card" />
            </a>
          )
        ) : (
          <p className="text-sm text-muted">No proof file</p>
        )}
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <div>
          <p className="font-display text-3xl font-extrabold text-foreground">{formatNaira(payment.amount)}</p>
          <p className="text-sm text-muted">Submitted {formatDateTime(payment.created_at)}</p>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted">Customer</dt>
          <dd className="font-medium text-foreground">
            {payment.customer?.name} <span className="text-muted">· {payment.customer?.email}</span>
          </dd>
          <dt className="text-muted">Sender name</dt>
          <dd className="font-medium text-foreground">{payment.sender_name}</dd>
          <dt className="text-muted">Transfer date</dt>
          <dd className="font-medium text-foreground">{formatDate(payment.transferred_on)}</dd>
          <dt className="text-muted">Expected reference</dt>
          <dd className="font-mono font-semibold text-foreground">{payment.invoice?.number}</dd>
        </dl>
        <a href={proofUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline">
          Open proof <ExternalLink className="size-3.5" />
        </a>

        {mode === "rejecting" ? (
          <div className="space-y-3">
            <TextareaField
              label="Reason (sent to the customer)"
              name={`reason-${payment.reference}`}
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. We can't find a matching credit for this amount on that date."
              autoFocus
            />
            <div className="flex gap-2">
              <Button variant="danger" onClick={reject} disabled={pending || !reason.trim()}>
                {pending ? <DotLoader className="text-current" /> : "Reject transfer"}
              </Button>
              <Button variant="outline" onClick={() => setMode("idle")} disabled={pending}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <TextareaField label="Note (optional, internal)" name={`note-${payment.reference}`} rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Button onClick={approve} disabled={pending}>
                {pending ? <DotLoader className="text-current" /> : <><Check className="size-4" /> Approve, money received</>}
              </Button>
              <Button variant="outline" className="text-danger" onClick={() => setMode("rejecting")} disabled={pending}>
                <X className="size-4" /> Reject
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
