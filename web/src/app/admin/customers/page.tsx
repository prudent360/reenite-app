import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight, Search, Users } from "lucide-react";
import { CustomerStatusButton } from "@/components/admin/customer-status-button";
import { PageHeader } from "@/components/app/page-header";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { can, requireStaff } from "@/lib/session";
import type { Paginated, User } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Customers" };

export default function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  return (
    <>
      <PageHeader title="Customers" description="Everyone who has signed up for a Reenite account." />
      <Suspense fallback={<TableSkeleton />}>
        <CustomerTable searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function CustomerTable({ searchParams }: { searchParams: PageProps<"/admin/customers">["searchParams"] }) {
  const viewer = await requireStaff("customers.view");
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q : "";
  const status = params.status === "active" || params.status === "suspended" ? params.status : "";
  const page = Math.max(1, Number(params.page) || 1);

  const query = new URLSearchParams({ page: String(page), per_page: "15" });
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-surface-muted text-xs font-semibold uppercase tracking-wider text-muted">
              <tr>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Phone</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Joined</th>
                {canManage && <th className="px-5 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {customers.map((customer) => (
                <tr key={customer.id} className="hover:bg-surface-muted/50">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={customer.name} className="size-8" />
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{customer.name}</p>
                        <p className="truncate text-xs text-muted">{customer.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-muted">{customer.phone ?? "—"}</td>
                  <td className="px-5 py-3.5">
                    {customer.email_verified ? <Badge tone="success">Verified</Badge> : <Badge tone="warning">Unverified</Badge>}
                  </td>
                  <td className="px-5 py-3.5">
                    {customer.status === "active" ? <Badge tone="info">Active</Badge> : <Badge tone="danger">Suspended</Badge>}
                  </td>
                  <td className="px-5 py-3.5 text-muted">{formatDate(customer.created_at)}</td>
                  {canManage && (
                    <td className="px-5 py-3.5 text-right">
                      <CustomerStatusButton userId={customer.id} name={customer.name} status={customer.status} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
