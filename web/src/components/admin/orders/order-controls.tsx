"use client";

import { useState, useTransition } from "react";
import { Ban, Check, CircleCheck, MessageCircleQuestion, Play, X } from "lucide-react";
import { toast } from "sonner";
import { assignOrder, cancelAdminOrder, completeOrder, requestOrderInfo, reviewOrderFile, setOrderStage, startOrder, uploadDeliverable } from "@/lib/actions/admin-orders";
import type { FormState, Order, OrderFile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DotLoader } from "@/components/ui/loader";
import { TextareaField } from "@/components/ui/form";
import { UploadButton } from "@/components/orders/order-interactive";

function useAction() {
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<FormState>, onDone?: () => void) =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(result.message);
        onDone?.();
      } else {
        toast.error(result.message ?? Object.values(result.errors ?? {})[0]?.[0] ?? "Something went wrong.");
      }
    });
  return { pending, run };
}

export function AssignSelect({ order, assignees }: { order: Order; assignees: { id: number; name: string; role: string | null }[] }) {
  const { pending, run } = useAction();
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted">Officer</span>
      <select
        value={order.officer?.id ?? ""}
        disabled={pending}
        onChange={(event) => run(() => assignOrder(order.reference, event.target.value ? Number(event.target.value) : null))}
        className="mt-1.5 h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground disabled:opacity-60"
      >
        <option value="">Unassigned</option>
        {assignees.map((person) => (
          <option key={person.id} value={person.id}>
            {person.name}
            {person.role ? ` (${person.role.replaceAll("_", " ")})` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Stage list with "move here" buttons, plus the order's main actions. */
export function WorkControls({ order, canCancel }: { order: Order; canCancel: boolean }) {
  const { pending, run } = useAction();
  const [panel, setPanel] = useState<"none" | "info" | "complete" | "cancel">("none");
  const [text, setText] = useState("");
  const active = order.status === "received" || order.status === "in_progress" || order.status === "awaiting_client";
  const close = () => {
    setPanel("none");
    setText("");
  };

  return (
    <div className="space-y-5">
      {active && order.stages.length > 0 && (
        <ol className="space-y-1.5">
          {order.stages.map((stage) => (
            <li key={stage.index}>
              <button
                type="button"
                disabled={pending || stage.state === "current"}
                onClick={() => run(() => setOrderStage(order.reference, stage.index))}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition disabled:cursor-default",
                  stage.state === "current" ? "border-navy-900 bg-navy-900 text-white dark:border-navy-700 dark:bg-navy-700" : "border-border hover:border-brand-500/60",
                )}
              >
                <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold", stage.state === "done" ? "bg-brand-500 text-white" : stage.state === "current" ? "bg-white/15" : "bg-surface-muted text-muted")}>
                  {stage.state === "done" ? <Check className="size-3.5" strokeWidth={3} /> : stage.index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{stage.name}</span>
                  {!stage.customer_visible && <span className={cn("block text-[11px]", stage.state === "current" ? "text-navy-200" : "text-muted")}>Staff only, no email</span>}
                </span>
                {stage.state !== "current" && <span className="text-xs font-semibold text-brand-600">Move here</span>}
              </button>
            </li>
          ))}
        </ol>
      )}

      {active && (
        <div className="grid gap-2 sm:grid-cols-2">
          {order.status === "received" && (
            <Button className="sm:col-span-2" disabled={pending} onClick={() => run(() => startOrder(order.reference))}>
              <Play className="size-4" /> Start work
            </Button>
          )}
          <Button variant="outline" disabled={pending} onClick={() => setPanel(panel === "info" ? "none" : "info")}>
            <MessageCircleQuestion className="size-4" /> Request info
          </Button>
          <Button variant="navy" disabled={pending} onClick={() => setPanel(panel === "complete" ? "none" : "complete")}>
            <CircleCheck className="size-4" /> Complete
          </Button>
        </div>
      )}

      {panel === "info" && (
        <div className="space-y-3 rounded-xl border border-border p-4">
          <TextareaField label="What do you need from the customer?" name="info" rows={3} value={text} onChange={(event) => setText(event.target.value)} hint="Posted in the chat and emailed. The order pauses until they respond." />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={close}>Cancel</Button>
            <Button size="sm" disabled={pending || !text.trim()} onClick={() => run(() => requestOrderInfo(order.reference, text), close)}>
              {pending ? <DotLoader className="text-current" /> : "Send request"}
            </Button>
          </div>
        </div>
      )}
      {panel === "complete" && (
        <div className="space-y-3 rounded-xl border border-border p-4">
          {(order.deliverables?.length ?? 0) === 0 && <p className="text-sm font-medium text-warning">No documents uploaded for the customer yet. Upload the certificate first if there is one.</p>}
          <TextareaField label="Closing note (optional)" name="note" rows={2} value={text} onChange={(event) => setText(event.target.value)} hint="Shown in the customer's activity." />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={close}>Cancel</Button>
            <Button variant="navy" size="sm" disabled={pending} onClick={() => run(() => completeOrder(order.reference, text), close)}>
              {pending ? <DotLoader className="text-current" /> : "Mark complete and email customer"}
            </Button>
          </div>
        </div>
      )}

      {canCancel && order.status !== "completed" && order.status !== "cancelled" && (
        panel === "cancel" ? (
          <div className="space-y-3 rounded-xl border border-danger/40 p-4">
            <TextareaField label="Reason for cancelling" name="reason" rows={2} value={text} onChange={(event) => setText(event.target.value)} hint="The customer sees this. Refund any payment separately in Finance." />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={close}>Keep order</Button>
              <Button size="sm" className="bg-danger hover:bg-danger/90" disabled={pending || !text.trim()} onClick={() => run(() => cancelAdminOrder(order.reference, text), close)}>
                {pending ? <DotLoader className="text-current" /> : "Cancel order"}
              </Button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setPanel("cancel")} className="inline-flex items-center gap-1.5 text-sm font-medium text-danger hover:underline">
            <Ban className="size-4" /> Cancel order
          </button>
        )
      )}
    </div>
  );
}

export function ReviewButtons({ reference, file }: { reference: string; file: OrderFile }) {
  const { pending, run } = useAction();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");

  if (rejecting) {
    return (
      <div className="mt-2 w-full space-y-2">
        <TextareaField label="What needs to change?" name={`note-${file.id}`} rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setRejecting(false)}>Back</Button>
          <Button size="sm" className="bg-danger hover:bg-danger/90" disabled={pending || !note.trim()} onClick={() => run(() => reviewOrderFile(reference, file.id, "rejected", note), () => setRejecting(false))}>
            Reject
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-1.5">
      {file.status !== "accepted" && (
        <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => reviewOrderFile(reference, file.id, "accepted", ""))} aria-label={`Accept ${file.label}`}>
          <Check className="size-4 text-success" /> Accept
        </Button>
      )}
      {file.status !== "rejected" && (
        <Button variant="outline" size="sm" disabled={pending} onClick={() => setRejecting(true)} aria-label={`Reject ${file.label}`}>
          <X className="size-4 text-danger" /> Reject
        </Button>
      )}
    </div>
  );
}

export function DeliverableUpload({ reference }: { reference: string }) {
  return <UploadButton label="Upload for customer" variant="primary" upload={(formData) => uploadDeliverable(reference, formData)} />;
}
