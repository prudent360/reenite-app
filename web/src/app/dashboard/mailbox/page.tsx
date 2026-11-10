import type { Metadata } from "next";
import { Suspense } from "react";
import { FileText, Mail, Mailbox as MailboxIcon, Package, ScrollText } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { CopyAddress } from "@/components/mailbox/copy-address";
import { MailItemActions } from "@/components/mailbox/mail-item-actions";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Badge, Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireCustomer } from "@/lib/session";
import type { MailItem, Mailbox } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Mailbox" };

const kindIcons = { letter: Mail, parcel: Package, official: ScrollText };

export default function MailboxPage() {
  return (
    <>
      <PageHeader title="Mailbox" description="Your virtual office address and the mail we've received for you." />
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Mailboxes />
      </Suspense>
    </>
  );
}

async function Mailboxes() {
  await requireCustomer();
  const { data: mailboxes } = await api<{ data: Mailbox[] }>("/mailbox");

  if (mailboxes.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={MailboxIcon}
          title="No virtual office yet"
          description="Get a business address at a Reenite location. We receive your letters and parcels, email you when something arrives, and collect, forward, scan or shred it as you ask."
          action={<ButtonLink href="/dashboard/workspace">See memberships</ButtonLink>}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {mailboxes.map((mailbox) => (
        <MailboxCard key={mailbox.id} mailbox={mailbox} />
      ))}
    </div>
  );
}

function MailboxCard({ mailbox }: { mailbox: Mailbox }) {
  const items = mailbox.items ?? [];
  const waiting = items.filter((item) => item.status === "waiting");
  const done = items.filter((item) => item.status !== "waiting");
  const lines = mailbox.address_lines ?? [];

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
              Mailbox {mailbox.number} · {mailbox.location?.name}
              {mailbox.state === "active" && <Badge tone="success">Active</Badge>}
              {mailbox.state === "lapsed" && <Badge tone="warning">Renewal due</Badge>}
              {mailbox.state === "closed" && <Badge tone="neutral">Closed</Badge>}
            </p>
            <address className="mt-3 text-[15px] not-italic leading-relaxed text-foreground">
              {lines.map((line, index) => (
                <span key={line} className={index === 0 ? "block font-semibold" : "block"}>
                  {line}
                </span>
              ))}
            </address>
            {mailbox.active_until && mailbox.state !== "closed" && (
              <p className="mt-3 text-sm text-muted">
                {mailbox.state === "active" ? "Paid up until" : "Your plan ended on"} {formatDate(mailbox.active_until)}
              </p>
            )}
          </div>
          {mailbox.state !== "closed" && <CopyAddress lines={lines} />}
        </div>
        {mailbox.state === "lapsed" && (
          <div className="border-t border-border p-5 sm:px-6">
            <Alert tone="warning" title="Renew to keep this address">
              We&apos;re still holding any mail for you. Renew your membership to keep using this address.
            </Alert>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="At the front desk" description={waiting.length ? "Tell us what to do with each item." : undefined} />
        {waiting.length === 0 ? (
          <EmptyState icon={Mail} title="No mail waiting" description="We'll email you as soon as something arrives." />
        ) : (
          <ul className="divide-y divide-border">
            {waiting.map((item) => (
              <MailRow key={item.id} item={item} closed={mailbox.state === "closed"} />
            ))}
          </ul>
        )}
      </Card>

      {done.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader title="Past mail" />
          <ul className="divide-y divide-border">
            {done.map((item) => (
              <MailRow key={item.id} item={item} closed />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function MailRow({ item, closed }: { item: MailItem; closed: boolean }) {
  const Icon = kindIcons[item.kind] ?? Mail;

  return (
    <li className="flex gap-4 px-5 py-4 sm:px-6">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-foreground">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
            {item.kind_label} from {item.sender || "unknown sender"}
            {item.status !== "waiting" && <Badge tone="neutral">{item.status_label}</Badge>}
          </p>
          <p className="text-sm text-muted">
            Arrived {formatDate(item.received_at)}
            {item.description ? ` · ${item.description}` : ""}
            {item.handled_at ? ` · ${item.status_label} ${formatDate(item.handled_at)}` : ""}
            {item.handled_note ? ` · ${item.handled_note}` : ""}
          </p>
        </div>
        {item.has_scan && (
          <a href={`/files/mail/${item.id}/scan`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline">
            <FileText className="size-4" /> View scan
          </a>
        )}
        <MailItemActions item={item} disabled={closed} />
      </div>
    </li>
  );
}
