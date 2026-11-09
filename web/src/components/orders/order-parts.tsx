import { Check, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/card";
import type { Order, OrderFile, Person } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

const statusTones: Record<Order["status"], "warning" | "info" | "brand" | "success" | "neutral" | "danger"> = {
  awaiting_payment: "warning",
  received: "info",
  in_progress: "info",
  awaiting_client: "brand",
  completed: "success",
  cancelled: "neutral",
};

export function OrderStatusBadge({ order }: { order: Pick<Order, "status" | "status_label" | "is_overdue"> }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge tone={statusTones[order.status]}>{order.status_label}</Badge>
      {order.is_overdue && <Badge tone="danger">Overdue</Badge>}
    </span>
  );
}

/** Vertical stage tracker. Staff see hidden stages marked "staff only". */
export function StageTracker({ order }: { order: Order }) {
  if (order.stages.length === 0) {
    return null;
  }
  return (
    <ol>
      {order.stages.map((stage, index) => (
        <li key={stage.index} className="relative flex gap-4 pb-5 last:pb-0">
          {index < order.stages.length - 1 && (
            <span className={cn("absolute left-[13px] top-8 h-[calc(100%-20px)] w-0.5", stage.state === "done" ? "bg-brand-500" : "bg-navy-100")} aria-hidden />
          )}
          <span
            className={cn(
              "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full",
              stage.state === "done" && "bg-brand-500 text-white",
              stage.state === "current" && "bg-navy-900 text-white ring-4 ring-navy-100 dark:bg-navy-700",
              stage.state === "upcoming" && "border-2 border-navy-100 bg-surface",
            )}
          >
            {stage.state === "done" && <Check className="size-4" strokeWidth={3} />}
            {stage.state === "current" && <span className="size-2 rounded-full bg-brand-400" />}
          </span>
          <div className="pt-0.5">
            <p className={cn("flex items-center gap-2 text-sm", stage.state === "upcoming" ? "text-muted" : "font-semibold text-foreground")}>
              {stage.name}
              {!stage.customer_visible && (
                <span className="inline-flex items-center gap-1 text-[11px] font-normal text-muted">
                  <EyeOff className="size-3" /> staff only
                </span>
              )}
            </p>
            {stage.description && <p className="text-xs text-muted">{stage.description}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-navy-50" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label="Order progress">
      <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${value}%` }} />
    </div>
  );
}

export function FileStatus({ file }: { file: OrderFile | null }) {
  if (!file) return <Badge tone="neutral">Not uploaded</Badge>;
  if (file.status === "accepted") return <Badge tone="success">Accepted</Badge>;
  if (file.status === "rejected") return <Badge tone="danger">Needs replacing</Badge>;
  return <Badge tone="info">Under review</Badge>;
}

/** An intake answer, formatted for reading. */
export function AnswerValue({ answer, fileHref }: { answer: NonNullable<Order["answers"]>[number]; fileHref?: (file: OrderFile) => string }) {
  if (answer.type === "file") {
    return answer.file && fileHref ? (
      <a href={fileHref(answer.file)} target="_blank" rel="noreferrer" className="font-medium text-brand-600 hover:underline">
        {answer.file.name}
      </a>
    ) : (
      <span className="text-muted">Not uploaded</span>
    );
  }
  if (answer.type === "people") {
    const people = (answer.value as Person[] | null) ?? [];
    return people.length ? (
      <ul className="space-y-1">
        {people.map((person, index) => (
          <li key={index}>
            <span className="font-medium text-foreground">{person.full_name}</span>
            <span className="text-muted">{[person.email, person.phone, person.id_number && `ID ${person.id_number}`].filter(Boolean).map((part) => ` · ${part}`)}</span>
          </li>
        ))}
      </ul>
    ) : (
      <span className="text-muted">None</span>
    );
  }
  if (answer.type === "checkbox") {
    return <span className="text-foreground">{answer.value ? "Yes" : "No"}</span>;
  }
  const text = answer.value === null || answer.value === "" ? null : String(answer.value);
  return text ? <span className="whitespace-pre-line text-foreground">{text}</span> : <span className="text-muted">Not answered</span>;
}

export function ActivityList({ events }: { events: NonNullable<Order["events"]> }) {
  return (
    <ul className="space-y-4">
      {events.map((event) => (
        <li key={event.id} className="flex gap-3 text-sm">
          <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", event.customer_visible ? "bg-brand-500" : "bg-navy-200")} />
          <div>
            <p className="text-foreground">
              {event.message}
              {!event.customer_visible && <span className="ml-1.5 text-[11px] text-muted">(staff only)</span>}
            </p>
            <p className="text-xs text-muted">
              {formatDateTime(event.created_at)}
              {event.by && ` · ${event.by}`}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
