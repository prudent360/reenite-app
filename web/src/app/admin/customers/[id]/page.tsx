import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { ArrowLeft, Building2, CalendarDays, ClipboardList, FileText, Mail, MessagesSquare, Ticket } from "lucide-react";
import { CustomerStatusButton } from "@/components/admin/customer-status-button";
import { MessageCustomerButton } from "@/components/admin/customers/message-customer-button";
import { Avatar } from "@/components/ui/avatar";
import { Badge, Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { ApiError, api } from "@/lib/api";
import { formatWhen } from "@/lib/booking-format";
import { can, requireStaff } from "@/lib/session";
import type { CustomerOverview, User } from "@/lib/types";
import { formatDate, formatDateTime, formatNaira } from "@/lib/utils";

export const metadata: Metadata = { title: "Customer" };

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

/** One colour per kind of status, whichever record it belongs to. */
function toneFor(status: string): Tone {
  if (["confirmed", "checked_in", "completed", "paid", "active"].includes(status)) return "success";
  if (["held", "pending_approval", "unpaid", "pending", "pending_payment", "awaiting_info", "lapsed"].includes(status)) return "warning";
  if (["in_progress", "submitted", "processing"].includes(status)) return "info";
  return "neutral";
}

export default function CustomerPage({ params }: PageProps<"/admin/customers/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[480px] rounded-2xl" />}>
      {params.then(({ id }) => (
        <CustomerDetail id={id} />
      ))}
    </Suspense>
  );
}

async function CustomerDetail({ id }: { id: string }) {
  const viewer = await requireStaff("customers.view");
  let customer: User;
  let overview: CustomerOverview;
  try {
    ({ data: customer, overview } = await api<{ data: User; overview: CustomerOverview }>(`/admin/customers/${encodeURIComponent(id)}`));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const canManage = can(viewer, "customers.manage");
  const { totals } = overview;

  return (
    <>
      <Link href="/admin/customers" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Customers
      </Link>

      <Card className="mb-6 p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <Avatar name={customer.name} src={customer.avatar_url} className="size-14 text-lg" />
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-extrabold text-foreground">{customer.name}</h1>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {customer.status === "active" ? <Badge tone="info">Active</Badge> : <Badge tone="danger">Suspended</Badge>}
                {customer.email_verified ? <Badge tone="success">Email verified</Badge> : <Badge tone="warning">Email not verified</Badge>}
                {customer.must_change_password && <Badge tone="warning">Imported, hasn&apos;t set a password yet</Badge>}
              </div>
            </div>
          </div>
          {canManage && (
            <div className="flex shrink-0 flex-wrap gap-2">
              <MessageCustomerButton customer={customer} />
              <CustomerStatusButton userId={customer.id} name={customer.name} status={customer.status} />
            </div>
          )}
        </div>

        <dl className="mt-6 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Detail label="Email">
            <a href={`mailto:${customer.email}`} className="break-all hover:text-brand-600">
              {customer.email}
            </a>
          </Detail>
          <Detail label="Phone">
            {customer.phone ? (
              <a href={`tel:${customer.phone.replace(/\s/g, "")}`} className="hover:text-brand-600">
                {customer.phone}
              </a>
            ) : (
              <span className="text-muted">Not given</span>
            )}
            {customer.whatsapp_updates && <span className="block text-xs text-muted">Gets WhatsApp updates</span>}
          </Detail>
          <Detail label="Joined">{formatDate(customer.created_at)}</Detail>
          <Detail label="Last signed in">{customer.last_login_at ? formatDateTime(customer.last_login_at) : <span className="text-muted">Never</span>}</Detail>
        </dl>
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Bookings" value={String(totals.bookings)} />
        <Stat label="Orders" value={String(totals.orders)} />
        <Stat label="Paid in total" value={formatNaira(totals.paid)} />
        <Stat label="Owing" value={formatNaira(totals.outstanding)} warn={totals.outstanding > 0} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <Section icon={CalendarDays} title="Bookings" count={totals.bookings} empty="No bookings yet.">
          {overview.bookings.map((booking) => (
            <Row
              key={booking.reference}
              href={`/admin/bookings/${booking.reference}`}
              title={booking.space_name}
              detail={`${formatWhen(booking)} · ${booking.location_name}`}
              status={booking.status}
              statusLabel={booking.status_label}
              aside={formatNaira(booking.total)}
            />
          ))}
        </Section>

        <Section icon={ClipboardList} title="Orders" count={totals.orders} empty="No orders yet.">
          {overview.orders.map((order) => (
            <Row
              key={order.reference}
              href={`/admin/orders/${order.reference}`}
              title={order.service_name}
              detail={`${order.reference} · ${formatDate(order.created_at)}`}
              status={order.status}
              statusLabel={order.status_label}
            />
          ))}
        </Section>

        <Section icon={FileText} title="Invoices" empty="No invoices yet.">
          {overview.invoices.map((invoice) => (
            <Row
              key={invoice.id}
              href={`/admin/finance/invoices/${invoice.id}`}
              title={invoice.number}
              detail={invoice.status === "unpaid" && invoice.due_at ? `Due ${formatDate(invoice.due_at)}` : formatDate(invoice.created_at)}
              status={invoice.status}
              statusLabel={invoice.status_label}
              aside={formatNaira(invoice.total)}
            />
          ))}
        </Section>

        <Section icon={MessagesSquare} title="Consultations" count={totals.consultations} empty="No consultations yet.">
          {overview.consultations.map((consultation) => (
            <Row
              key={consultation.reference}
              href={`/admin/consultations/${consultation.reference}`}
              title={consultation.name}
              detail={formatDateTime(consultation.starts_at)}
              status={consultation.status}
              statusLabel={consultation.status_label}
            />
          ))}
        </Section>

        <Section icon={Ticket} title="Passes and memberships" empty="No passes or memberships.">
          {overview.plans.map((plan, index) => (
            <Row
              key={`${plan.kind}-${index}`}
              title={plan.name}
              detail={`${plan.kind} · ${plan.starts_at ? `${formatDate(plan.starts_at)} to ${formatDate(plan.ends_at)}` : "Not started yet"}`}
              status={plan.status}
              statusLabel={plan.status.replace(/_/g, " ").replace(/^\w/, (letter) => letter.toUpperCase())}
            />
          ))}
        </Section>

        <Section icon={Building2} title="Businesses and mailboxes" empty="No businesses or mailboxes.">
          {overview.businesses.map((business) => (
            <Row key={`business-${business.id}`} title={business.name} detail={[business.entity_type, business.registration_number].filter(Boolean).join(" · ") || "Business"} />
          ))}
          {overview.mailboxes.map((mailbox) => (
            <Row
              key={`mailbox-${mailbox.id}`}
              href={`/admin/mail/${mailbox.id}`}
              title={`Mailbox ${mailbox.number}`}
              detail={`${mailbox.business_name}${mailbox.active_until ? ` · until ${formatDate(mailbox.active_until)}` : ""}`}
              status={mailbox.status}
              statusLabel={mailbox.status.replace(/^\w/, (letter) => letter.toUpperCase())}
              icon={Mail}
            />
          ))}
        </Section>
      </div>
    </>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-1 font-medium text-foreground">{children}</dd>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <Card className="px-4 py-3.5">
      <p className={warn ? "font-display text-2xl font-extrabold text-warning" : "font-display text-2xl font-extrabold text-foreground"}>{value}</p>
      <p className="text-sm text-muted">{label}</p>
    </Card>
  );
}

function Section({ icon: Icon, title, count, empty, children }: { icon: typeof Mail; title: string; count?: number; empty: string; children: ReactNode[] }) {
  const rows = children.flat().filter(Boolean);
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Icon className="size-4 text-muted" /> {title}
          </span>
        }
        description={count !== undefined && count > rows.length ? `Latest ${rows.length} of ${count}` : undefined}
      />
      {rows.length === 0 ? <p className="px-5 pb-5 text-sm text-muted">{empty}</p> : <ul className="divide-y divide-border border-t border-border">{rows}</ul>}
    </Card>
  );
}

function Row({ href, title, detail, status, statusLabel, aside, icon: Icon }: { href?: string; title: string; detail: string; status?: string; statusLabel?: string; aside?: string; icon?: typeof Mail }) {
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 truncate font-semibold text-foreground">
          {Icon && <Icon className="size-3.5 shrink-0 text-muted" />}
          {title}
        </span>
        <span className="block truncate text-muted">{detail}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        {status && <Badge tone={toneFor(status)}>{statusLabel ?? status}</Badge>}
        {aside && <span className="font-semibold text-foreground">{aside}</span>}
      </span>
    </>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-surface-muted/50">
          {body}
        </Link>
      ) : (
        <div className="flex items-center gap-3 px-5 py-3 text-sm">{body}</div>
      )}
    </li>
  );
}
