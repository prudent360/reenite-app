import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  Armchair,
  ArrowRight,
  Building2,
  Calculator,
  CalendarDays,
  Check,
  ClipboardList,
  FolderLock,
  Globe,
  ListChecks,
  PartyPopper,
  Sparkles,
  Store,
  Wallet,
  Ticket,
  FileSignature,
} from "lucide-react";
import { OrderStatusBadge, ProgressBar } from "@/components/orders/order-parts";
import { HeroBanner, Panel, StatTile, StatTilesSkeleton } from "@/components/app/dashboard-widgets";
import { VerifyEmailBanner } from "@/components/app/verify-email-banner";
import { ButtonLink } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireCustomer } from "@/lib/session";
import { formatWhen } from "@/lib/booking-format";
import type { Agreement, Booking, Invoice, Order, Paginated, User, VaultFile } from "@/lib/types";
import { cn, firstName, formatNaira } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <Overview searchParams={searchParams} />
    </Suspense>
  );
}

const quickActions = [
  { label: "Register a business", body: "CAC Business Name or LTD", href: "/dashboard/services", icon: Building2 },
  { label: "Sort out tax", body: "TIN, VAT and tax clearance", href: "/dashboard/services", icon: Calculator },
  { label: "Get online", body: "Domain, email and website", href: "/dashboard/services", icon: Globe },
  { label: "Book a space", body: "Desk, office or studio", href: "/dashboard/workspace", icon: Armchair },
];

function greeting(): string {
  const hour = Number(new Intl.DateTimeFormat("en-NG", { hour: "numeric", hour12: false, timeZone: "Africa/Lagos" }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

function setupSteps(user: User, hasOrdered: boolean) {
  return [
    { label: "Create your account", done: true },
    { label: "Verify your email", done: user.email_verified },
    { label: "Add your phone number", done: Boolean(user.phone), href: "/dashboard/settings" },
    { label: "Add your business", done: false, href: "/dashboard/businesses" },
    { label: "Order your first service", done: hasOrdered, href: "/dashboard/services" },
  ];
}

const viewLink = (href: string, label: string) => (
  <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
    {label} <ArrowRight className="size-4" />
  </Link>
);

async function Overview({ searchParams }: { searchParams: PageProps<"/dashboard">["searchParams"] }) {
  const [user, params] = await Promise.all([requireCustomer(), searchParams]);
  const [{ data: invoices }, { data: orders }, { data: documents }, { data: bookings }, { data: agreements }] = await Promise.all([
    api<Paginated<Invoice>>("/billing/invoices"),
    api<Paginated<Order>>("/orders"),
    api<{ data: VaultFile[] }>("/documents"),
    api<Paginated<Booking>>("/my-bookings"),
    api<{ data: Agreement[] }>("/agreements"),
  ]);
  const toSign = agreements.filter((agreement) => !agreement.signed_at && agreement.is_open);
  // My bookings come back upcoming first, soonest first.
  const upcoming = bookings.filter((booking) => ["held", "pending_approval", "confirmed", "checked_in"].includes(booking.status));
  const next = upcoming.find((booking) => booking.status === "confirmed" || booking.status === "checked_in");
  const activeOrders = orders.filter((order) => order.status !== "completed" && order.status !== "cancelled");
  const unpaid = invoices.filter((invoice) => invoice.status === "unpaid" && !invoice.has_pending_transfer);
  const unpaidTotal = unpaid.reduce((sum, invoice) => sum + invoice.balance, 0);
  const steps = setupSteps(user, orders.some((order) => order.status !== "cancelled"));
  const percent = Math.round((steps.filter((step) => step.done).length / steps.length) * 100);

  return (
    <div className="space-y-6 lg:space-y-8">
      {(params.welcome || !user.email_verified || unpaid.length > 0 || toSign.length > 0) && (
        <div className="space-y-3">
          {toSign.length > 0 && (
            <Alert
              tone="info"
              icon={FileSignature}
              title={toSign.length === 1 ? `Please sign: ${toSign[0]!.title}` : `${toSign.length} agreements are waiting for your signature`}
              action={
                <ButtonLink href={toSign.length === 1 ? `/dashboard/agreements/${toSign[0]!.id}` : "/dashboard/agreements"} size="sm" className="sm:ml-auto">
                  Read and sign
                </ButtonLink>
              }
            >
              Reenite has already signed. Sign online and download your copy straight away.
            </Alert>
          )}
          {unpaid.length > 0 && (
            <Alert
              tone="warning"
              icon={Wallet}
              title={unpaid.length === 1 ? `Invoice ${unpaid[0]!.number} is waiting for payment` : `${unpaid.length} invoices are waiting for payment`}
              action={
                <ButtonLink href={unpaid.length === 1 ? `/dashboard/billing/invoices/${unpaid[0]!.id}` : "/dashboard/billing"} size="sm" className="sm:ml-auto">
                  Pay {formatNaira(unpaidTotal)}
                </ButtonLink>
              }
            >
              Pay online or by bank transfer from your Billing page.
            </Alert>
          )}
          {params.welcome && (
            <Alert tone="success" icon={PartyPopper} title="Welcome to Reenite!">
              Your account is ready. Follow the checklist below to get set up.
            </Alert>
          )}
          {!user.email_verified && <VerifyEmailBanner email={user.email} />}
        </div>
      )}

      <HeroBanner
        title={`${greeting()}, ${firstName(user.name)}`}
        subtitle="Here's where your business stands today."
        actions={
          <>
            <ButtonLink href="/dashboard/services" variant="light">
              <Sparkles className="size-4" /> Start a service
            </ButtonLink>
            <ButtonLink href="/dashboard/workspace/book" variant="glass">
              <Armchair className="size-4" /> Book a space
            </ButtonLink>
          </>
        }
        stats={[
          { value: `${percent}%`, label: "Setup complete" },
          { value: String(activeOrders.length), label: "Active orders" },
        ]}
      />

      {next && (
        <Link
          href={`/dashboard/workspace/${next.reference}/pass`}
          className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 transition hover:border-brand-500/50 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="flex items-center gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success">
              <Ticket className="size-6" />
            </span>
            <span>
              <span className="block text-sm text-muted">Your next booking</span>
              <span className="block font-semibold text-foreground">
                {next.space_name} · {formatWhen(next)}
              </span>
            </span>
          </span>
          <span className="flex items-center gap-3 text-sm">
            <span className="font-mono text-lg font-bold tracking-widest text-foreground">{next.check_in_code}</span>
            <span className="inline-flex items-center gap-1 font-semibold text-brand-600">
              View pass <ArrowRight className="size-4" />
            </span>
          </span>
        </Link>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={ClipboardList} tone="navy" value={activeOrders.length} label="Active orders" hint="Services in progress" />
        <StatTile icon={CalendarDays} tone="info" value={upcoming.length} label="Upcoming bookings" hint="At Reenite Uyo" />
        <StatTile icon={FolderLock} tone="brand" value={documents.length} label="Documents" hint="In your secure vault" />
        <StatTile icon={Building2} tone="solid" value="0" label="Businesses" hint="Registered or in progress" />
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <Panel icon={ListChecks} title="Get set up" className="xl:col-span-2">
          <div className="px-5 pt-4 sm:px-7">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">
                {steps.filter((step) => step.done).length} of {steps.length} steps done
              </span>
              <span className="font-semibold text-foreground">{percent}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-brand-50" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Setup progress">
              <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${percent}%` }} />
            </div>
          </div>
          <ul className="mt-4 divide-y divide-border pb-2">
            {steps.map((step) => {
              const content = (
                <>
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full",
                      step.done ? "bg-brand-500 text-white" : "border-2 border-navy-100",
                    )}
                  >
                    {step.done && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                  <span className={cn("flex-1 text-sm", step.done ? "text-muted line-through" : "font-medium text-foreground")}>{step.label}</span>
                  {!step.done && step.href && <ArrowRight className="size-4 text-muted" />}
                </>
              );
              return (
                <li key={step.label}>
                  {!step.done && step.href ? (
                    <Link href={step.href} className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-muted sm:px-7">
                      {content}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 px-5 py-3.5 sm:px-7">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel icon={Store} title="Quick actions" action={viewLink("/dashboard/services", "All services")} className="xl:col-span-3">
          <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-7">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="group flex items-center gap-4 rounded-2xl border border-border p-4 transition hover:-translate-y-0.5 hover:border-brand-500/50 hover:shadow-card"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-navy-900 text-white transition group-hover:bg-brand-500 dark:bg-navy-700">
                  <action.icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-foreground">{action.label}</span>
                  <span className="block truncate text-sm text-muted">{action.body}</span>
                </span>
                <ArrowRight className="size-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
              </Link>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel icon={ClipboardList} title="Active orders" action={viewLink("/dashboard/orders", "View all")}>
          {activeOrders.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No active orders"
              description="When you order a service, you'll follow every step here, from documents received to certificate issued."
              action={<ButtonLink href="/dashboard/services" variant="outline" size="sm">Browse services</ButtonLink>}
            />
          ) : (
            <ul className="mt-3 divide-y divide-border pb-2">
              {activeOrders.slice(0, 4).map((order) => (
                <li key={order.reference}>
                  <Link href={`/dashboard/orders/${order.reference}`} className="block px-5 py-4 hover:bg-surface-muted/50 sm:px-7">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">{order.service.name}</p>
                        <p className="font-mono text-xs text-muted">{order.reference}</p>
                      </div>
                      <OrderStatusBadge order={order} />
                    </div>
                    <div className="mt-3"><ProgressBar value={order.progress} /></div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel icon={CalendarDays} title="Upcoming bookings" action={viewLink("/dashboard/workspace", "Book")}>
          <EmptyState
            icon={CalendarDays}
            title="Nothing booked yet"
            description="Book a hot desk, private office, podcast studio or event space at Reenite Uyo."
            action={<ButtonLink href="/dashboard/workspace" variant="outline" size="sm">Book a space</ButtonLink>}
          />
        </Panel>
      </div>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6 lg:space-y-8" aria-busy>
      <Skeleton className="h-56 rounded-3xl" />
      <StatTilesSkeleton />
      <div className="grid gap-6 xl:grid-cols-5">
        <Skeleton className="h-80 rounded-2xl xl:col-span-2" />
        <Skeleton className="h-80 rounded-2xl xl:col-span-3" />
      </div>
    </div>
  );
}
