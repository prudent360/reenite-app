import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-2xl border border-border bg-surface shadow-card", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4 sm:px-6", className)}>
      <div className="min-w-0">
        <h2 className="text-base font-bold text-foreground">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "navy";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-muted text-muted",
  brand: "bg-brand-50 text-brand-700",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  navy: "bg-navy-900 text-white",
};

export function Badge({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", tones[tone], className)}
      {...props}
    />
  );
}

export function Alert({
  tone = "info",
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  tone?: Exclude<Tone, "navy" | "neutral">;
  icon?: LucideIcon;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div role="status" className={cn("flex flex-col gap-3 rounded-xl px-4 py-3 text-sm sm:flex-row sm:items-center", tones[tone], className)}>
      <div className="flex min-w-0 flex-1 gap-3">
        {Icon && <Icon className="mt-0.5 size-4 shrink-0" />}
        <div className="min-w-0">
          {title && <p className="font-semibold">{title}</p>}
          {children && <div className={cn(title && "mt-0.5 opacity-90")}>{children}</div>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-14 text-center", className)}>
      <div className="relative mb-5">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-navy-50 text-foreground">
          <Icon className="size-7" strokeWidth={1.75} />
        </div>
        <span className="absolute -right-1.5 -top-1.5 size-4 rounded-full border-[3px] border-surface bg-brand-500" />
      </div>
      <h3 className="text-lg font-bold text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
