import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, ArrowUpRight, Armchair } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { BookingStatusBadge } from "@/components/booking/booking-parts";
import { BookingCountdownChip } from "@/components/booking/booking-tracker";
import { BuyPlanButton } from "@/components/booking/buy-plan-button";
import { PlanCard } from "@/components/booking/plan-card";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { bookingHref, getBookingSettings, getWorkspaceCatalogue } from "@/lib/booking";
import { formatWhen } from "@/lib/booking-format";
import { requireCustomer } from "@/lib/session";
import type { Booking, MyPlans, Paginated } from "@/lib/types";
import { formatNaira } from "@/lib/utils";

export const metadata: Metadata = { title: "Workspace" };

export default async function WorkspacePage() {
  const settings = await getBookingSettings();
  const external = settings.destination === "external";

  return (
    <>
      <PageHeader
        title="Workspace"
        description="Your bookings, passes and membership at Reenite Uyo."
        actions={
          <ButtonLink href={external ? bookingHref(settings) : "/dashboard/workspace/book"}>
            Book a space {external ? <ArrowUpRight className="size-4" /> : <ArrowRight className="size-4" />}
          </ButtonLink>
        }
      />
      {external && (
        <Alert tone="info" className="mb-6" title="Bookings are on book.reenite.com for now">
          Book desks, offices, the studio and event halls on our booking site. Anything you booked here before is still listed below.
        </Alert>
      )}
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Workspace external={external} />
      </Suspense>
    </>
  );
}

async function Workspace({ external }: { external: boolean }) {
  await requireCustomer();
  const [{ data: bookings }, plans, catalogue] = await Promise.all([
    api<Paginated<Booking>>("/my-bookings"),
    api<MyPlans>("/plans"),
    getWorkspaceCatalogue(),
  ]);
  const upcoming = bookings.filter((booking) => ["held", "pending_approval", "confirmed", "checked_in"].includes(booking.status));
  const past = bookings.filter((booking) => !upcoming.includes(booking));

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader title="Upcoming" />
        {upcoming.length === 0 ? (
          <EmptyState icon={Armchair} title="Nothing booked yet" description="Book a desk, office, the studio or an event hall. You'll find your check-in code here." className="py-14" />
        ) : (
          <BookingList bookings={upcoming} />
        )}
      </Card>

      {(plans.passes.length > 0 || plans.memberships.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {plans.memberships.map((membership) => (
            <PlanCard key={`m-${membership.id}`} plan={membership} kind="memberships" card={plans.card} />
          ))}
          {plans.passes.map((pass) => (
            <PlanCard key={`p-${pass.id}`} plan={pass} kind="passes" card={plans.card} />
          ))}
        </div>
      )}

      {!external && catalogue && (catalogue.pass_plans.length > 0 || catalogue.memberships.length > 0) && (
        <section id="plans" className="scroll-mt-24">
          <h2 className="text-lg font-bold text-foreground">Work here often? Pay less.</h2>
          <p className="text-sm text-muted">A pass covers your visits for a week or a month. A membership takes money off every booking.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {catalogue.pass_plans.map((plan) => (
              <Card key={`pp-${plan.id}`} className="flex flex-col p-5">
                <p className="font-semibold text-foreground">{plan.name}</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{formatNaira(plan.price)}</p>
                <p className="mt-1 flex-1 text-sm text-muted">{plan.allowance}{plan.space_types?.length ? ` · ${plan.space_types.join(", ")}` : ""}</p>
                <div className="mt-4">
                  <BuyPlanButton kind="passes" planId={plan.id} label="Buy pass" />
                </div>
              </Card>
            ))}
            {catalogue.memberships.map((plan) => (
              <Card key={`mp-${plan.id}`} className="flex flex-col p-5">
                <p className="font-semibold text-foreground">{plan.name} membership</p>
                <p className="mt-1 text-2xl font-bold text-foreground">
                  {formatNaira(plan.price)}
                  <span className="text-sm font-normal text-muted">/{plan.billing_period}</span>
                </p>
                <p className="mt-1 flex-1 text-sm text-muted">{plan.booking_discount_percent}% off every booking{plan.mailbox_location ? ` · Business address and mailbox at ${plan.mailbox_location}` : ""}{plan.perks.length ? ` · ${plan.perks.join(" · ")}` : ""}</p>
                <div className="mt-4">
                  <BuyPlanButton kind="memberships" planId={plan.id} label="Join" featured={plan.is_featured} />
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <Card>
          <CardHeader title="Past and cancelled" />
          <BookingList bookings={past} />
        </Card>
      )}
    </div>
  );
}

function BookingList({ bookings }: { bookings: Booking[] }) {
  return (
    <ul className="divide-y divide-border">
      {bookings.map((booking) => (
        <li key={booking.reference}>
          <Link href={`/dashboard/workspace/${booking.reference}`} className="flex flex-col gap-2 px-5 py-4 transition hover:bg-surface-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                {booking.space_name} <BookingStatusBadge booking={booking} /> <BookingCountdownChip booking={booking} />
              </p>
              <p className="mt-0.5 text-sm text-muted">{formatWhen(booking)}</p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              {booking.check_in_code && <span className="font-mono font-semibold tracking-widest text-foreground">{booking.check_in_code}</span>}
              <span className="text-muted">{formatNaira(booking.invoice?.total ?? booking.total)}</span>
              <ArrowRight className="size-4 text-muted" />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
