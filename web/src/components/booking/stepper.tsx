import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const BOOKING_STEPS = ["Space", "Time", "Details", "Pay"];

/**
 * Numbered steps joined by lines; finished steps show a tick. `onSelect` lets people jump back
 * to a step they've already done.
 */
export function Stepper({ current, onSelect, steps = BOOKING_STEPS }: { current: number; onSelect?: (step: number) => void; steps?: string[] }) {
  return (
    <ol aria-label="Booking steps" className="flex items-center gap-2 overflow-x-auto pb-1">
      {steps.map((label, index) => {
        const done = index < current;
        const active = index === current;
        const content = (
          <>
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                done || active ? "bg-brand-600 text-white" : "bg-navy-50 text-muted",
              )}
            >
              {done ? <Check className="size-3.5" strokeWidth={3} aria-label={`${label}, done`} /> : index + 1}
            </span>
            {/* On phones only the current step is named, so all the steps fit on one line. */}
            <span className={cn("whitespace-nowrap text-sm", active ? "font-semibold text-foreground" : "hidden text-muted sm:inline")}>{label}</span>
          </>
        );
        return (
          <li key={label} className="flex shrink-0 items-center gap-2" aria-current={active ? "step" : undefined}>
            {done && onSelect ? (
              <button type="button" onClick={() => onSelect(index)} className="flex items-center gap-2 rounded-full hover:opacity-80">
                {content}
              </button>
            ) : (
              <span className="flex items-center gap-2">{content}</span>
            )}
            {index < steps.length - 1 && <span aria-hidden className={cn("h-px w-5 sm:w-10", done ? "bg-brand-600" : "bg-border")} />}
          </li>
        );
      })}
    </ol>
  );
}
