import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, FileText, Mail } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { MailDeskActions } from "@/components/admin/mail/mail-desk-actions";
import { LogMailForm } from "@/components/admin/mail/log-mail-form";
import { EditMailboxForm } from "@/components/admin/mail/mailbox-forms";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { ApiError, api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import type { MailItem, Mailbox } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Mailbox" };

const stateBadges = {
  active: { tone: "success", label: "Active" },
  lapsed: { tone: "warning", label: "Lapsed: plan ended" },
  closed: { tone: "neutral", label: "Closed" },
} as const;

export default function MailboxAdminPage({ params }: PageProps<"/admin/mail/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[480px] rounded-2xl" />}>
      {params.then(({ id }) => (
        <MailboxDetail id={id} />
      ))}
    </Suspense>
  );
}

async function MailboxDetail({ id }: { id: string }) {
  await requireStaff("mail.manage");
  let mailbox: Mailbox;
  try {
    ({ data: mailbox } = await api<{ data: Mailbox }>(`/admin/mail/mailboxes/${encodeURIComponent(id)}`));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const items = mailbox.items ?? [];
  const badge = stateBadges[mailbox.state];

  return (
    <>
      <Link href="/admin/mail?view=mailboxes" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Mailboxes
      </Link>
      <PageHeader title={`${mailbox.number} · ${mailbox.business_name}`} description={`${mailbox.customer?.name ?? ""} · ${mailbox.customer?.email ?? ""}${mailbox.customer?.phone ? ` · ${mailbox.customer.phone}` : ""}`} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px] xl:items-start">
        <div className="space-y-6">
          <Card className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <address className="text-[15px] not-italic leading-relaxed text-foreground">
                {(mailbox.address_lines ?? []).map((line, index) => (
                  <span key={line} className={index === 0 ? "block font-semibold" : "block"}>
                    {line}
                  </span>
                ))}
              </address>
              <div className="space-y-1 text-right text-sm">
                <Badge tone={badge.tone}>{badge.label}</Badge>
                <p className="text-muted">{mailbox.active_until ? `Paid until ${formatDate(mailbox.active_until)}` : "No end date"}</p>
                {mailbox.membership && <p className="text-muted">Via {mailbox.membership.name} membership</p>}
              </div>
            </div>
            {mailbox.notes && <p className="mt-4 rounded-lg bg-surface-muted px-3 py-2 text-sm text-foreground">{mailbox.notes}</p>}
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Mail" description={`${mailbox.waiting_count ?? 0} at the front desk`} />
            {items.length === 0 ? (
              <EmptyState icon={Mail} title="No mail logged yet" description="Use the form to log the first letter or parcel." />
            ) : (
              <ul className="divide-y divide-border">
                {items.map((item) => (
                  <ItemRow key={item.id} item={item} />
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6 xl:sticky xl:top-24">
          {mailbox.status !== "closed" && (
            <Card>
              <CardHeader title="Log mail" description="The customer is emailed straight away." />
              <div className="p-5">
                <LogMailForm mailboxId={mailbox.id} />
              </div>
            </Card>
          )}
          <Card>
            <CardHeader title="Mailbox details" />
            <div className="p-5">
              <EditMailboxForm mailbox={mailbox} />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function ItemRow({ item }: { item: MailItem }) {
  return (
    <li className="space-y-3 px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
            {item.kind_label} from {item.sender || "unknown sender"}
            <Badge tone={item.status === "waiting" ? "info" : "neutral"}>{item.status_label}</Badge>
            {item.request_label && <Badge tone="brand">Asked: {item.request_label}</Badge>}
          </p>
          <p className="text-sm text-muted">
            Arrived {formatDate(item.received_at)}
            {item.logged_by ? ` · logged by ${item.logged_by}` : ""}
            {item.description ? ` · ${item.description}` : ""}
          </p>
          {item.request_note && <p className="mt-1 whitespace-pre-line rounded-lg bg-surface-muted px-3 py-2 text-sm text-foreground">{item.request_note}</p>}
          {item.handled_at && (
            <p className="text-sm text-muted">
              {item.status_label} {formatDateTime(item.handled_at)}
              {item.handled_by ? ` by ${item.handled_by}` : ""}
              {item.handled_note ? ` · ${item.handled_note}` : ""}
            </p>
          )}
        </div>
        {item.has_scan && (
          <a href={`/files/admin/mail/${item.id}/scan`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline">
            <FileText className="size-4" /> Scan
          </a>
        )}
      </div>
      <MailDeskActions item={item} />
    </li>
  );
}
