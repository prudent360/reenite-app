import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** A small app window used in homepage illustrations. */
export function MockWindow({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border bg-surface shadow-pop", className)}>
      <div className="border-b border-border px-4 py-3">
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

/** Notification pill pinned to the edge of an illustration. */
export function FloatBadge({
  icon: Icon,
  children,
  className,
  tone = "navy",
}: {
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
  tone?: "navy" | "brand" | "success";
}) {
  const tones = {
    navy: "bg-navy-900 text-white dark:bg-navy-700",
    brand: "bg-brand-500 text-white",
    success: "bg-success text-white dark:text-navy-950",
  };
  return (
    <div
      className={cn("absolute z-10 flex items-center gap-2.5 rounded-md border border-border bg-surface py-2 pl-2 pr-4 text-sm font-semibold text-foreground shadow-card", className)}
    >
      <span className={cn("flex size-7 items-center justify-center rounded-md", tones[tone])}>
        <Icon className="size-3.5" />
      </span>
      <span className="whitespace-nowrap">{children}</span>
    </div>
  );
}

export function MiniBar({ label, value, percent, tone = "brand" }: { label: string; value: string; percent: number; tone?: "brand" | "navy" }) {
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="font-semibold text-foreground">{label}</span>
        <span className="text-muted">{value}</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-navy-50">
        <div className={cn("h-full rounded-full", tone === "brand" ? "bg-brand-500" : "bg-navy-700 dark:bg-navy-400")} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
