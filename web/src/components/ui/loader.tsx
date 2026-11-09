import { cn } from "@/lib/utils";

/** Three bouncing dots, echoing the dots in the Reenite mark. */
export function DotLoader({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label} className={cn("inline-flex items-center gap-1 text-brand-500", className)}>
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="size-1.5 animate-dot rounded-full bg-current"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-lg", className)} aria-hidden />;
}
