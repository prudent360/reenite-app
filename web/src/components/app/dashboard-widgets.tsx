import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { cn } from "@/lib/utils";

/** Navy greeting banner with the poster's diamond pattern and a glass panel of headline figures. */
export function HeroBanner({
  title,
  subtitle,
  actions,
  stats,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  stats?: { value: ReactNode; label: string }[];
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700 px-6 py-8 text-white shadow-pop sm:px-10 sm:py-10 dark:from-navy-800 dark:via-navy-800 dark:to-navy-700">
      <div className="bg-diamonds absolute inset-y-0 right-0 w-2/3 opacity-80 [mask-image:linear-gradient(to_left,black,transparent)]" aria-hidden />
      <div className="absolute -right-24 -top-24 size-72 rounded-full bg-brand-500/25 blur-3xl" aria-hidden />
      <LogoMark
        className="absolute -bottom-24 -left-12 size-64 opacity-[0.05]"
        dotClassName="fill-white"
        chevronClassName="fill-white"
      />

      <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl lg:text-[2.75rem]">{title}</h1>
          <p className="mt-2 text-base text-navy-200 sm:text-lg">{subtitle}</p>
          {actions && <div className="mt-6 flex flex-wrap gap-3">{actions}</div>}
        </div>

        {stats && stats.length > 0 && (
          <dl className="grid shrink-0 grid-cols-2 gap-6 rounded-2xl border border-white/15 bg-white/[0.06] px-6 py-5 backdrop-blur-sm sm:gap-10 sm:px-8">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dd className="font-display text-3xl font-extrabold">{stat.value}</dd>
                <dt className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-navy-200">{stat.label}</dt>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}

type TileTone = "navy" | "brand" | "success" | "info" | "solid";

const tileTones: Record<TileTone, string> = {
  navy: "bg-navy-50 text-navy-700 dark:text-navy-200",
  brand: "bg-brand-50 text-brand-600",
  success: "bg-success-soft text-success",
  info: "bg-info-soft text-info",
  solid: "bg-navy-900 text-white dark:bg-navy-700",
};

/** Stat tile: icon chip, value, label, optional hint, with the icon repeated as a faint watermark. */
export function StatTile({
  icon: Icon,
  value,
  label,
  hint,
  tone = "navy",
}: {
  icon: LucideIcon;
  value: ReactNode;
  label: string;
  hint?: ReactNode;
  tone?: TileTone;
}) {
  return (
    <Card className="relative overflow-hidden p-5 sm:p-6">
      <Icon className="pointer-events-none absolute -bottom-5 -right-4 size-28 text-navy-50" strokeWidth={1.25} aria-hidden />
      <div className="relative flex items-start gap-4">
        <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-xl", tileTones[tone])}>
          <Icon className="size-[22px]" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-3xl font-extrabold leading-none tracking-tight text-foreground">{value}</p>
          <p className="mt-2 text-sm font-medium text-foreground/80">{label}</p>
          {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
        </div>
      </div>
    </Card>
  );
}

/** Card with an icon + title header and an optional "View all" style link. */
export function Panel({
  icon: Icon,
  title,
  action,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <div className="flex items-center justify-between gap-3 px-5 pt-5 sm:px-7 sm:pt-6">
        <h2 className="flex items-center gap-2.5 text-lg font-bold text-foreground">
          <Icon className="size-5 text-brand-500" />
          {title}
        </h2>
        {action}
      </div>
      <div className="flex-1">{children}</div>
    </Card>
  );
}

export function StatTilesSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className="h-32 rounded-2xl" />
      ))}
    </div>
  );
}
