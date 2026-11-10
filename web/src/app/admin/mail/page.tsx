import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, FileText, Inbox, Mailbox as MailboxIcon, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { MailDeskActions } from "@/components/admin/mail/mail-desk-actions";
import { MailTabs } from "@/components/admin/mail/mail-tabs";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import type { MailItem, Mailbox, Paginated } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Mail" };

export default function MailPage({ searchParams }: PageProps<"/admin/mail">) {
  return (
    <>
      <PageHeader
        title="Mail"
        description="Virtual office mail: log what arrives, then collect, forward, scan or shred it as customers ask."
        actions={
          <ButtonLink href="/admin/mail/new">
            <Plus className="size-4" /> Open a mailbox
          </ButtonLink>
        }
      />
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        {searchParams.then((query) =>
          query.view === "mailboxes" ? (
            <Mailboxes search={typeof query.q === "string" ? query.q : ""} state={typeof query.state === "string" ? query.state : ""} />
          ) : (
            <Desk />
          ),
        )}
      </Suspense>
    </>
  );
}

async function Desk() {
  await requireStaff("mail.manage");
  const { data: items } = await api<Paginated<MailItem>>("/admin/mail");
  const requests = items.filter((item) => item.requested_action).length;

  return (
    <>
      <MailTabs active="desk" requests={requests} />
      <Card className="overflow-hidden">
        {items.length === 0 ? (
          <EmptyState icon={Inbox} title="Nothing at the front desk" description="Log mail from a mailbox page when it arrives. Customer requests show up here first." />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="space-y-3 px-5 py-4 sm:px-6">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                      {item.kind_label} from {item.sender || "unknown sender"}
                      {item.request_label && <Badge tone="brand">Asked: {item.request_label}</Badge>}
                    </p>
                    <p className="text-sm text-muted">
                      {item.mailbox && (
                        <Link href={`/admin/mail/${item.mailbox.id}`} className="font-semibold text-foreground hover:underline">
                          {item.mailbox.number} · {item.mailbox.business_name}
                        </Link>
                      )}
                      {item.mailbox?.customer ? ` (${item.mailbox.customer.name})` : ""} · arrived {formatDate(item.received_at)}
                      {item.description ? ` · ${item.description}` : ""}
                    </p>
                    {item.requested_at && (
                      <p className="text-sm text-foreground">
                        Requested {formatDateTime(item.requested_at)}
                        {item.request_note && <span className="mt-1 block whitespace-pre-line rounded-lg bg-surface-muted px-3 py-2">{item.request_note}</span>}
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
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

const stateBadges = {
  active: { tone: "success", label: "Active" },
  lapsed: { tone: "warning", label: "Lapsed" },
  closed: { tone: "neutral", label: "Closed" },
} as const;

async function Mailboxes({ search, state }: { search: string; state: string }) {
  await requireStaff("mail.manage");
  const query = new URLSearchParams();
  if (search) query.set("search", search);
  if (["active", "lapsed", "closed"].includes(state)) query.set("state", state);
  const { data: mailboxes } = await api<Paginated<Mailbox>>(`/admin/mail/mailboxes?${query}`);

  return (
    <>
      <MailTabs active="mailboxes" />
      <Card className="overflow-hidden">
        <form className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:p-5">
          <input type="hidden" name="view" value="mailboxes" />
          <label className="relative flex-1">
            <span className="sr-only">Search mailboxes</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input name="q" defaultValue={search} placeholder="Mailbox number, business or customer" className="h-10 w-full rounded-xl border border-border bg-surface pl-10 pr-3 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15" />
          </label>
          <select name="state" defaultValue={state} aria-label="Filter by state" className="h-10 rounded-xl border border-border bg-surface px-3 text-sm text-foreground">
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="lapsed">Lapsed</option>
            <option value="closed">Closed</option>
          </select>
          <button type="submit" className={buttonClasses({ variant: "navy", size: "sm", className: "h-10" })}>
            Filter
          </button>
        </form>
        {mailboxes.length === 0 ? (
          <EmptyState
            icon={MailboxIcon}
            title={search || state ? "No mailboxes match" : "No mailboxes yet"}
            description="Mailboxes open when a customer pays for a membership with a virtual office, or you can open one by hand."
            action={<ButtonLink href="/admin/mail/new">Open a mailbox</ButtonLink>}
          />
        ) : (
          <ul className="divide-y divide-border">
            {mailboxes.map((mailbox) => {
              const badge = stateBadges[mailbox.state];
              return (
                <li key={mailbox.id}>
                  <Link href={`/admin/mail/${mailbox.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-surface-muted/60 sm:px-6">
                    <span className="w-20 shrink-0 font-mono text-sm font-bold text-foreground">{mailbox.number}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                        {mailbox.business_name} <Badge tone={badge.tone}>{badge.label}</Badge>
                      </span>
                      <span className="block truncate text-sm text-muted">
                        {mailbox.customer?.name} · {mailbox.location?.name}
                        {mailbox.active_until ? ` · until ${formatDate(mailbox.active_until)}` : ""}
                      </span>
                    </span>
                    <span className="hidden shrink-0 text-right text-sm sm:block">
                      <span className="block font-semibold text-foreground">{mailbox.waiting_count ?? 0} waiting</span>
                      {(mailbox.request_count ?? 0) > 0 && <span className="block text-brand-600">{mailbox.request_count} to do</span>}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-navy-300" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
