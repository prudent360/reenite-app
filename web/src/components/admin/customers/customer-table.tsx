"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Ban, Mail, RotateCcw, Trash2, X } from "lucide-react";
import { CustomerStatusButton } from "@/components/admin/customer-status-button";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { DotLoader } from "@/components/ui/loader";
import { deleteCustomers, setCustomersStatus } from "@/lib/actions/admin";
import type { User } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import { MessageCustomersDialog } from "./message-customers-dialog";

/**
 * The customer list. Staff who manage customers can tick several (or the whole page) and message,
 * suspend, reactivate or delete them together. The page gives it a key per page of results, so a
 * new page starts with nothing selected.
 */
export function CustomerTable({ customers, canManage }: { customers: User[]; canManage: boolean }) {
  const [selected, setSelected] = useState<number[]>([]);
  const [messaging, setMessaging] = useState(false);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const allBox = useRef<HTMLInputElement>(null);

  const allSelected = customers.length > 0 && selected.length === customers.length;
  useEffect(() => {
    if (allBox.current) allBox.current.indeterminate = selected.length > 0 && !allSelected;
  }, [selected.length, allSelected]);

  const chosen = customers.filter((customer) => selected.includes(customer.id));
  const people = chosen.length === 1 ? chosen[0].name : `${chosen.length} customers`;

  function toggle(id: number) {
    setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  function bulk(key: string, confirmText: string | null, action: () => Promise<{ ok?: boolean; message?: string }>) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(key);
    startTransition(async () => {
      const result = await action();
      setBusy(null);
      if (result.ok) {
        toast.success(result.message);
        setSelected([]);
      } else {
        toast.error(result.message ?? "That didn't work. Please try again.");
      }
    });
  }

  return (
    <>
      {canManage && selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-brand-500/5 px-4 py-3 sm:px-5" role="toolbar" aria-label="Actions for selected customers">
          <p className="mr-auto text-sm font-semibold text-foreground">{chosen.length} selected</p>
          <Button size="sm" variant="navy" onClick={() => setMessaging(true)} disabled={pending}>
            <Mail className="size-4" /> Message
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => bulk("suspend", `Suspend ${people}? They will be signed out and unable to sign in.`, () => setCustomersStatus(selected, "suspended"))}
          >
            {busy === "suspend" ? <DotLoader className="text-current" label="Suspending" /> : <><Ban className="size-4" /> Suspend</>}
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => bulk("activate", null, () => setCustomersStatus(selected, "active"))}>
            {busy === "activate" ? <DotLoader className="text-current" label="Reactivating" /> : <><RotateCcw className="size-4" /> Reactivate</>}
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={pending}
            onClick={() =>
              bulk(
                "delete",
                `Delete ${people}? This can't be undone. Anyone with bookings, orders or payments on record is kept, so suspend them instead.`,
                () => deleteCustomers(selected),
              )
            }
          >
            {busy === "delete" ? <DotLoader className="text-current" label="Deleting" /> : <><Trash2 className="size-4" /> Delete</>}
          </Button>
          <Button size="icon" variant="ghost" className="size-9" onClick={() => setSelected([])} aria-label="Clear selection">
            <X className="size-4" />
          </Button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-surface-muted text-xs font-semibold uppercase tracking-wider text-muted">
            <tr>
              {canManage && (
                <th className="w-12 py-3 pl-5">
                  <input
                    ref={allBox}
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? [] : customers.map((customer) => customer.id))}
                    aria-label="Select every customer on this page"
                    className="size-4 rounded border-border accent-brand-500"
                  />
                </th>
              )}
              <th className="px-5 py-3">Customer</th>
              <th className="px-5 py-3">Phone</th>
              <th className="px-5 py-3">Email</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Joined</th>
              {canManage && <th className="px-5 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {customers.map((customer) => {
              const isSelected = selected.includes(customer.id);
              return (
                <tr key={customer.id} className={cn("hover:bg-surface-muted/50", isSelected && "bg-brand-500/5")}>
                  {canManage && (
                    <td className="py-3.5 pl-5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(customer.id)}
                        aria-label={`Select ${customer.name}`}
                        className="size-4 rounded border-border accent-brand-500"
                      />
                    </td>
                  )}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={customer.name} className="size-8" />
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{customer.name}</p>
                        <p className="truncate text-xs text-muted">{customer.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-muted">{customer.phone ?? "Not given"}</td>
                  <td className="px-5 py-3.5">{customer.email_verified ? <Badge tone="success">Verified</Badge> : <Badge tone="warning">Unverified</Badge>}</td>
                  <td className="px-5 py-3.5">{customer.status === "active" ? <Badge tone="info">Active</Badge> : <Badge tone="danger">Suspended</Badge>}</td>
                  <td className="px-5 py-3.5 text-muted">{formatDate(customer.created_at)}</td>
                  {canManage && (
                    <td className="px-5 py-3.5 text-right">
                      <CustomerStatusButton userId={customer.id} name={customer.name} status={customer.status} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {messaging && (
        <MessageCustomersDialog
          customers={chosen}
          onClose={(sent) => {
            setMessaging(false);
            if (sent) setSelected([]);
          }}
        />
      )}
    </>
  );
}
