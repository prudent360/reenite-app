import { AlertTriangle, CalendarClock, ClipboardPen } from "lucide-react";
import type { BusinessHealth, ComplianceItem } from "@/lib/types";
import { Badge } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const bandColours = {
  good: { ring: "stroke-success", text: "text-success", tone: "success" },
  attention: { ring: "stroke-warning", text: "text-warning", tone: "warning" },
  risk: { ring: "stroke-danger", text: "text-danger", tone: "danger" },
} as const;

/** The 0 to 100 business health score as a ring. */
export function HealthRing({ health, size = "md" }: { health: BusinessHealth; size?: "sm" | "md" }) {
  const colours = bandColours[health.band];
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className={cn("relative shrink-0", size === "sm" ? "size-16" : "size-28")} role="img" aria-label={`Health score ${health.score} out of 100: ${health.label}`}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={radius} className="fill-none stroke-surface-muted" strokeWidth="10" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          className={cn("fill-none transition-all", colours.ring)}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - health.score / 100)}
        />
      </svg>
      <span className={cn("absolute inset-0 flex items-center justify-center font-bold", colours.text, size === "sm" ? "text-lg" : "text-3xl")}>{health.score}</span>
    </div>
  );
}

export function HealthBadge({ health }: { health: BusinessHealth }) {
  return <Badge tone={bandColours[health.band].tone}>{health.label}</Badge>;
}

const issueIcons = { overdue: AlertTriangle, due_soon: CalendarClock, details: ClipboardPen };

/** What's costing points, worst first. */
export function HealthIssues({ health, limit }: { health: BusinessHealth; limit?: number }) {
  const issues = limit ? health.issues.slice(0, limit) : health.issues;
  if (issues.length === 0) {
    return <p className="text-sm text-muted">Nothing needs your attention. Keep marking deadlines done as you file them.</p>;
  }
  return (
    <ul className="space-y-2">
      {issues.map((issue) => {
        const Icon = issueIcons[issue.kind];
        return (
          <li key={issue.text} className="flex items-start gap-2.5 text-sm">
            <Icon className={cn("mt-0.5 size-4 shrink-0", issue.kind === "overdue" ? "text-danger" : issue.kind === "due_soon" ? "text-warning" : "text-muted")} />
            <span className="min-w-0 flex-1 text-foreground">{issue.text}</span>
            <span className="shrink-0 text-xs font-semibold text-muted">-{issue.points}</span>
          </li>
        );
      })}
    </ul>
  );
}

export const stateBadges: Record<ComplianceItem["state"], { tone: "danger" | "warning" | "info" | "success" | "neutral"; label: string }> = {
  overdue: { tone: "danger", label: "Overdue" },
  due_soon: { tone: "warning", label: "Due soon" },
  upcoming: { tone: "info", label: "Upcoming" },
  done: { tone: "success", label: "Done" },
  dismissed: { tone: "neutral", label: "Not applicable" },
};

/** "in 3 days", "today", "5 days late". */
export function daysLeftLabel(item: Pick<ComplianceItem, "days_left" | "status">): string {
  if (item.status !== "open") return "";
  const days = item.days_left;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days > 1) return `In ${days} days`;
  return days === -1 ? "1 day late" : `${Math.abs(days)} days late`;
}
