import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight, Search, Users } from "lucide-react";
import { CustomerTable } from "@/components/admin/customers/customer-table";
import { PageHeader } from "@/components/app/page-header";
import { buttonClasses } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { can, requireStaff } from "@/lib/session";
import type { Paginated, User } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Customers" };

export default function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  return (
    <>
      <PageHeader title="Customers" description="Everyone who has signed up for a Reenite account." />
      <Suspense fallback={<TableSkeleton />}>
        <CustomerList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function CustomerList({ searchParams }: { searchParams: PageProps<"/admin/customers">["searchParams"] }) {
  const viewer = await requireStaff("customers.view");
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q : "";
  const status = params.status === "active" || params.status === "suspended" ? params.status : "";
  const page = Math.max(1, Number(params.page) || 1);

  const query = new URLSearchParams({ page: String(page), per_page: "25" });
  if (search) query.set("search", search);
  if (status) query.set("status", status);

  const { data: customers, meta } = await api<Paginated<User>>(`/admin/customers?${query}`);
  const canManage = can(viewer, "customers.manage");

  const pageHref = (target: number) => {
    const next = new URLSearchParams({ ...(search && { q: search }), ...(status && { status }), page: String(target) });
    return `/admin/customers?${next}`;
  };

  return (
    <Card className="overflow-hidden">
      <form className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:p-5">
        <label className="relative flex-1">
          <span className="sr-only">Search customers</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-navy-400" />
          <input
            name="q"
            defaultValue={search}
            placeholder="Search by name, email or phone"
            className="h-10 w-full rounded-xl border border-border bg-surface pl-10 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
          />
        </label>
        <select
          name="status"
          defaultValue={status}
          aria-label="Filter by status"
          className="h-10 rounded-xl border border-border bg-surface px-3 text-sm focus:border-brand-500 focus:outline-none"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <button type="submit" className={buttonClasses({ variant: "navy", size: "sm", className: "h-10" })}>
          Search
        </button>
      </form>

      {customers.length === 0 ? (
        <EmptyState icon={Users} title="No customers found" description={search ? `Nothing matches "${search}".` : "New sign-ups will appear here."} />
      ) : (
        <CustomerTable key={customers.map((customer) => customer.id).join(",")} customers={customers} canManage={canManage} />
      )}

      {meta.last_page > 1 && (
        <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm">
          <p className="text-muted">
            {meta.from} to {meta.to} of {meta.total}
          </p>
          <div className="flex gap-2">
            <PageLink href={pageHref(page - 1)} disabled={page <= 1} label="Previous page">
              <ChevronLeft className="size-4" />
            </PageLink>
            <PageLink href={pageHref(page + 1)} disabled={page >= meta.last_page} label="Next page">
              <ChevronRight className="size-4" />
            </PageLink>
          </div>
        </div>
      )}
    </Card>
  );
}

function PageLink({ href, disabled, label, children }: { href: string; disabled: boolean; label: string; children: React.ReactNode }) {
  const classes = buttonClasses({ variant: "outline", size: "icon", className: cn("size-9", disabled && "pointer-events-none opacity-40") });
  return disabled ? (
    <span className={classes} aria-disabled aria-label={label}>
      {children}
    </span>
  ) : (
    <Link href={href} className={classes} aria-label={label}>
      {children}
    </Link>
  );
}

function TableSkeleton() {
  return (
    <Card className="space-y-4 p-5" aria-busy>
      <Skeleton className="h-10 w-full rounded-xl" />
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </Card>
  );
}
