"use client";

import { useRef, useState, useTransition } from "react";
import { Lock, Send, Upload } from "lucide-react";
import { toast } from "sonner";
import { cancelOrder, sendOrderMessage, uploadOrderFile } from "@/lib/actions/orders";
import { postOrderMessage } from "@/lib/actions/admin-orders";
import type { FormState, Order } from "@/lib/types";
import { uploadTooLarge } from "@/lib/uploads";
import { cn, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DotLoader } from "@/components/ui/loader";

/** One-click upload: choosing a file sends it straight away. */
export function UploadButton({
  label = "Upload",
  upload,
  hidden,
  variant = "outline",
}: {
  label?: string;
  upload: (formData: FormData) => Promise<FormState>;
  hidden?: Record<string, string>;
  variant?: "outline" | "primary";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const tooLarge = uploadTooLarge(file);
    if (tooLarge) {
      toast.error(tooLarge);
      event.target.value = "";
      return;
    }
    const formData = new FormData();
    formData.set("file", file);
    Object.entries(hidden ?? {}).forEach(([key, value]) => formData.set(key, value));
    startTransition(async () => {
      const result = await upload(formData);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message ?? "Upload failed.");
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <>
      <input ref={inputRef} type="file" className="sr-only" accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp" onChange={onPick} tabIndex={-1} aria-hidden />
      <Button variant={variant} size="sm" onClick={() => inputRef.current?.click()} disabled={pending}>
        {pending ? <DotLoader className="text-current" label="Uploading" /> : <><Upload className="size-4" /> {label}</>}
      </Button>
    </>
  );
}

export function CustomerUpload({ reference, requirementId, fieldKey, label }: { reference: string; requirementId?: number; fieldKey?: string; label?: string }) {
  return (
    <UploadButton
      label={label}
      upload={(formData) => uploadOrderFile(reference, formData)}
      hidden={requirementId !== undefined ? { requirement_id: String(requirementId) } : { field_key: fieldKey ?? "" }}
    />
  );
}

/** Conversation between the customer and Reenite. Staff can also leave internal notes. */
export function MessageThread({ order, viewer }: { order: Order; viewer: "customer" | "staff" }) {
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [pending, startTransition] = useTransition();
  const messages = order.messages ?? [];

  function send() {
    if (!body.trim()) return;
    startTransition(async () => {
      const result = viewer === "staff" ? await postOrderMessage(order.reference, body, internal) : await sendOrderMessage(order.reference, body);
      if (result.ok) {
        setBody("");
        if (result.message) toast.success(result.message);
      } else {
        toast.error(result.message ?? result.errors?.body?.[0] ?? "Couldn't send.");
      }
    });
  }

  return (
    <div>
      <ul className="max-h-[420px] space-y-3 overflow-y-auto p-5">
        {messages.length === 0 && <li className="py-6 text-center text-sm text-muted">No messages yet. Questions about this order? Ask here.</li>}
        {messages.map((message) => {
          const mine = viewer === "staff" ? message.from_staff : !message.from_staff;
          return (
            <li key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                  message.is_internal ? "border border-dashed border-warning bg-warning-soft text-foreground" : mine ? "rounded-br-sm bg-navy-900 text-white dark:bg-navy-700" : "rounded-bl-sm bg-surface-muted text-foreground",
                )}
              >
                {message.is_internal && (
                  <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-warning">
                    <Lock className="size-3" /> Internal note
                  </p>
                )}
                <p className="whitespace-pre-line">{message.body}</p>
                <p className={cn("mt-1 text-[11px]", mine && !message.is_internal ? "text-navy-200" : "text-muted")}>
                  {message.author} · {formatDateTime(message.created_at)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      {order.status !== "cancelled" && (
        <div className="space-y-2 border-t border-border p-4">
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={2}
            placeholder={viewer === "staff" ? (internal ? "Note for the team (customer won't see it)" : "Message the customer") : "Write a message to your officer"}
            aria-label="Message"
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) send();
            }}
          />
          <div className="flex items-center justify-between gap-3">
            {viewer === "staff" ? (
              <label className="flex items-center gap-2 text-xs font-medium text-muted">
                <input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} className="accent-[#f05a28]" />
                Internal note
              </label>
            ) : (
              <span className="text-xs text-muted">Ctrl/⌘ + Enter to send</span>
            )}
            <Button size="sm" onClick={send} disabled={pending || !body.trim()}>
              {pending ? <DotLoader className="text-current" /> : <><Send className="size-4" /> {internal ? "Add note" : "Send"}</>}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function CancelOrderButton({ reference }: { reference: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-danger hover:bg-danger-soft"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Cancel this order? You haven't paid, so nothing will be charged.")) return;
        startTransition(async () => {
          const result = await cancelOrder(reference);
          if (result.ok) toast.success(result.message);
          else toast.error(result.message ?? "Couldn't cancel.");
        });
      }}
    >
      {pending ? <DotLoader className="text-danger" /> : "Cancel order"}
    </Button>
  );
}
