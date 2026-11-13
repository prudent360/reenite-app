"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Mail, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DotLoader } from "@/components/ui/loader";
import { messageCustomers } from "@/lib/actions/admin";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";

type Channel = "email" | "whatsapp";

/** Writes one message to the selected customers, by email, WhatsApp or both. */
export function MessageCustomersDialog({ customers, onClose }: { customers: User[]; onClose: (sent: boolean) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [channels, setChannels] = useState<Channel[]>(["email"]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const suspended = customers.filter((customer) => customer.status !== "active").length;

  function toggle(channel: Channel) {
    setChannels((current) => (current.includes(channel) ? current.filter((value) => value !== channel) : [...current, channel]));
  }

  function send(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await messageCustomers(
        customers.map((customer) => customer.id),
        { subject: subject.trim(), message: message.trim(), channels },
      );
      if (result.ok) {
        toast.success(result.message);
        onClose(true);
      } else {
        setErrors(result.errors ?? {});
        if (result.message) toast.error(result.message);
      }
    });
  }

  const field = "w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15";

  return (
    <dialog
      ref={dialog}
      onClose={() => onClose(false)}
      onClick={(event) => event.target === dialog.current && dialog.current?.close()}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-border bg-surface p-0 text-foreground shadow-pop backdrop:bg-navy-950/50"
    >
      <form onSubmit={send}>
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-bold">Message {customers.length === 1 ? customers[0].name : `${customers.length} customers`}</h2>
            <p className="mt-0.5 text-sm text-muted">Each person gets their own copy, starting &ldquo;Hi [first name],&rdquo;.</p>
          </div>
          <button type="button" onClick={() => dialog.current?.close()} className="rounded-lg p-1.5 text-muted hover:bg-surface-muted" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Subject</span>
            <input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={150} required className={cn(field, "h-10")} placeholder="e.g. We're closed on Friday" />
            {errors.subject && <span className="block text-sm text-danger">{errors.subject[0]}</span>}
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Message</span>
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2000} required rows={6} className={cn(field, "py-2.5")} />
            <span className="block text-right text-xs text-muted">{message.length}/2000</span>
            {errors.message && <span className="block text-sm text-danger">{errors.message[0]}</span>}
          </label>

          <fieldset className="space-y-2">
            <legend className="mb-1.5 text-sm font-semibold">Send by</legend>
            <ChannelOption icon={Mail} label="Email" description="Everyone selected." checked={channels.includes("email")} onChange={() => toggle("email")} />
            <ChannelOption
              icon={MessageCircle}
              label="WhatsApp"
              description="Only customers who agreed to WhatsApp updates, once your “Message from the team” template is approved in Settings, WhatsApp."
              checked={channels.includes("whatsapp")}
              onChange={() => toggle("whatsapp")}
            />
            {errors.channels && <span className="block text-sm text-danger">{errors.channels[0]}</span>}
          </fieldset>

          {suspended > 0 && <p className="rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning">{suspended === 1 ? "1 selected customer is" : `${suspended} selected customers are`} suspended and won&apos;t get this.</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <Button variant="ghost" onClick={() => dialog.current?.close()}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending || channels.length === 0 || !subject.trim() || !message.trim()}>
            {pending ? <DotLoader className="text-current" label="Sending" /> : "Send message"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}

function ChannelOption({ icon: Icon, label, description, checked, onChange }: { icon: typeof Mail; label: string; description: string; checked: boolean; onChange: () => void }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors", checked ? "border-brand-500 bg-brand-500/5" : "border-border hover:bg-surface-muted/50")}>
      <input type="checkbox" checked={checked} onChange={onChange} className="mt-0.5 size-4 accent-brand-500" />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <Icon className="size-4 text-muted" /> {label}
        </span>
        <span className="mt-0.5 block text-[13px] text-muted">{description}</span>
      </span>
    </label>
  );
}
