"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Item = { title: string; body: string };

/**
 * Auto-advancing feature list with a matching illustration, as on the reference design.
 * The active item's progress bar fills over `duration`; when it ends, the next item opens.
 * Pauses on hover/focus and while scrolled off screen. Clicking an item jumps to it.
 * With reduced motion the bar doesn't animate, so it only changes when clicked.
 */
export function FeatureTabs({
  items,
  scenes,
  numbered = false,
  duration = 5500,
  label,
}: {
  items: Item[];
  scenes: ReactNode[];
  numbered?: boolean;
  duration?: number;
  label: string;
}) {
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [inView, setInView] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const paused = hovered || !inView;

  useEffect(() => {
    const element = rootRef.current;
    if (!element) {
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setInView(Boolean(entry?.isIntersecting)), { threshold: 0.35 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const next = () => setActive((index) => (index + 1) % items.length);

  return (
    <div
      ref={rootRef}
      className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <div role="tablist" aria-label={label} aria-orientation="vertical">
        {items.map((item, index) => {
          const selected = index === active;
          return (
            <button
              key={item.title}
              type="button"
              role="tab"
              id={`${id}-tab-${index}`}
              aria-selected={selected}
              aria-controls={`${id}-panel`}
              onClick={() => setActive(index)}
              className="relative flex w-full gap-4 py-5 pl-7 text-left"
            >
              {/* The rail fills with the active step's timer, like a progress bar turned on its side. */}
              <span className="absolute inset-y-0 left-0 w-[3px] bg-border" aria-hidden>
                {selected && (
                  <span
                    key={active}
                    className="block h-full origin-top animate-step-progress-y bg-brand-500"
                    style={{ animationDuration: `${duration}ms`, animationPlayState: paused ? "paused" : "running" }}
                    onAnimationEnd={next}
                  />
                )}
              </span>
              {numbered && (
                <span className={cn("pt-0.5 font-display text-sm font-bold tabular-nums", selected ? "text-brand-600" : "text-muted")}>
                  {String(index + 1).padStart(2, "0")}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className={cn("block font-display text-lg font-bold transition-colors sm:text-xl", selected ? "text-foreground" : "text-muted")}>
                  {item.title}
                </span>
                <span
                  className={cn(
                    "grid transition-[grid-template-rows,opacity] duration-300",
                    selected ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                  )}
                >
                  <span className="overflow-hidden">
                    <span className="block pt-2 text-base leading-relaxed text-muted">{item.body}</span>
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-${active}`}
        className="flex min-h-[420px] min-w-0 items-center justify-center rounded-md bg-surface-muted p-4 sm:min-h-[480px] sm:p-12"
      >
        <div key={active} className="relative min-w-0 w-full max-w-md animate-scene-in">
          {scenes[active]}
        </div>
      </div>
    </div>
  );
}
