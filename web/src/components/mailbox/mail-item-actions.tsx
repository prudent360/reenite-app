"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelMailRequest, requestMail } from "@/lib/actions/mailbox";
import type { MailAction, MailItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { DotLoader } from "@/components/ui/loader";

/** What the customer can ask for on a waiting letter or parcel. */
export function MailItemActions({ item, disabled }: { item: MailItem; disabled?: boolean }) {
  const [forwarding, setForwarding] = useState(false);
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (item.status !== "waiting" || disabled) return null;

  function send(action: MailAction, note = "") {
    if (action === "shred" && !window.confirm("Shred this item? This can't be undone once we've done it.")) return;
    setError(null);
    startTransition(async () => {
      const result = await requestMail(item.id, action, note);
      if (result.ok) {
        toast.success(result.message);
        setForwarding(false);
      } else {
        setError(result.errors?.note?.[0] ?? result.message ?? "We couldn't send that request.");
      }
    });
  }

  if (item.requested_action) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">
          You asked: <span className="font-semibold text-foreground">{item.request_label}</span>
          {item.request_note ? ` (${item.request_note})` : ""}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await cancelMailRequest(item.id);
              if (result.ok) toast.success(result.message);
              else toast.error(result.message ?? "We couldn't cancel the request.");
            })
          }
        >
          {pending ? <DotLoader className="text-current" label="Cancelling" /> : "Cancel request"}
        </Button>
      </div>
    );
  }

  if (forwarding) {
    return (
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          send("forward", address.trim());
        }}
      >
        <label htmlFor={`forward-${item.id}`} className="text-sm font-medium text-foreground">
          Forward to
        </label>
        <textarea
          id={`forward-${item.id}`}
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          rows={2}
          maxLength={500}
          autoFocus
          placeholder="Full address and a phone number for the courier"
          className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none"
        />
        {error && <p className="text-[13px] text-danger">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={pending || !address.trim()}>
            {pending ? <DotLoader className="text-current" label="Sending" /> : "Send request"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setForwarding(false)}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={pending} onClick={() => send("collect")}>
          I&apos;ll collect it
        </Button>
        <Button variant="outline" size="sm" disabled={pending} onClick={() => setForwarding(true)}>
          Forward it
        </Button>
        {!item.has_scan && (
          <Button variant="outline" size="sm" disabled={pending} onClick={() => send("scan")}>
            Scan it
          </Button>
        )}
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => send("shred")}>
          Shred it
        </Button>
      </div>
      {error && <p className="text-[13px] text-danger">{error}</p>}
    </div>
  );
}
