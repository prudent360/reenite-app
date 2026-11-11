"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, MoreHorizontal, RotateCcw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { deleteReminder, setComplianceStatus } from "@/lib/actions/businesses";
import type { ComplianceItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { DotLoader } from "@/components/ui/loader";
import { cn, formatDate } from "@/lib/utils";
import { daysLeftLabel, stateBadges } from "./health";

/**
 * Deadlines with their actions: mark done, not applicable, reopen, or delete a custom reminder.
 * `showBusiness` adds the business name, for the list across all businesses.
 */
export function ComplianceList({ items, showBusiness = false }: { items: ComplianceItem[]; showBusiness?: boolean }) {
  return (
    <ul className="divide-y divide-border">
      {items.map((item) => (
        <ComplianceRow key={item.id} item={item} showBusiness={showBusiness} />
      ))}
    </ul>
  );
}

function ComplianceRow({ item, showBusiness }: { item: ComplianceItem; showBusiness: boolean }) {
  const [pending, startTransition] = useTransition();
  const [menu, setMenu] = useState(false);
  const badge = stateBadges[item.state];
  const open = item.status === "open";

  function act(call: () => Promise<{ ok?: boolean; message?: string }>) {
    setMenu(false);
    startTransition(async () => {
      const result = await call();
      if (result.ok) toast.success(result.message ?? "Saved.");
      else toast.error(result.message ?? "That didn't work. Please try again.");
    });
  }

  return (
    <li className={cn("flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6", !open && "opacity-70")}>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className={cn("font-semibold text-foreground", item.status === "dismissed" && "line-through")}>{item.title}</span>
          {item.period_label && <span className="text-sm text-muted">{item.period_label}</span>}
          <Badge tone={badge.tone}>{badge.label}</Badge>
        </p>
        <p className="mt-0.5 text-sm text-muted">
          {showBusiness && item.business ? <span className="font-medium text-foreground">{item.business.name} · </span> : null}
          Due {formatDate(item.due_on)}
          {open && <span className={cn("font-medium", item.days_left < 0 ? "text-danger" : item.days_left <= 14 ? "text-warning" : "")}> · {daysLeftLabel(item)}</span>}
          {item.authority && <span> · {item.authority}</span>}
        </p>
        {item.note && <p className="mt-1 text-sm text-muted">Note: {item.note}</p>}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {pending ? (
          <DotLoader className="text-navy-300" label="Saving" />
        ) : open ? (
          <>
            {item.service_slug && (
              <Link href={`/dashboard/services/${item.service_slug}`} className="text-sm font-semibold text-brand-600 hover:underline">
                Let us file it
              </Link>
            )}
            <Button size="sm" variant="outline" onClick={() => act(() => setComplianceStatus(item.id, "done"))}>
              <Check className="size-4" /> Done
            </Button>
            <div className="relative">
              <Button size="icon" variant="ghost" className="size-9" aria-label={`More options for ${item.title}`} aria-expanded={menu} onClick={() => setMenu((value) => !value)}>
                <MoreHorizontal className="size-4" />
              </Button>
              {menu && (
                <div className="absolute right-0 top-full z-10 mt-1 w-56 rounded-xl border border-border bg-surface py-1 shadow-pop">
                  <button type="button" className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm hover:bg-surface-muted" onClick={() => act(() => setComplianceStatus(item.id, "dismissed"))}>
                    <X className="size-4 text-muted" /> Doesn&apos;t apply to me
                  </button>
                  {item.is_custom && (
                    <button type="button" className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm text-danger hover:bg-surface-muted" onClick={() => act(() => deleteReminder(item.id))}>
                      <Trash2 className="size-4" /> Delete reminder
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => act(() => setComplianceStatus(item.id, "open"))}>
            <RotateCcw className="size-4" /> Reopen
          </Button>
        )}
      </div>
    </li>
  );
}
