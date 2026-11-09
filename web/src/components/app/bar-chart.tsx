"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type BarDatum = { key: string; label: string; value: number; tooltip?: string };

/**
 * "1.2K", "3.5M". Written out by hand because Intl's compact and currency output differs between
 * Node and browsers, which made server and client render different axis labels.
 */
function compact(value: number): string {
  const units: [number, string][] = [[1e9, "B"], [1e6, "M"], [1e3, "K"]];
  for (const [size, suffix] of units) {
    if (Math.abs(value) >= size) {
      return `${Number((value / size).toFixed(1))}${suffix}`;
    }
  }
  return String(Number(value.toFixed(1)));
}

/** Rounds the axis maximum up to a clean number (1, 2, 5 × 10ⁿ). */
function niceMax(value: number): number {
  if (value <= 0) {
    return 4;
  }
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= value)!;
  return step * magnitude;
}

/**
 * Single-series column chart. One hue (brand orange, validated in light and dark),
 * 24px columns with a 4px rounded cap, a label on the tallest column only,
 * per-column hover tooltips and a screen-reader table.
 */
export function BarChart({
  data,
  unit,
  format = "number",
  height = 220,
  caption,
  period = "Month",
}: {
  data: BarDatum[];
  /** Noun for the tooltip, e.g. "new customers". */
  unit: string;
  format?: "number" | "naira";
  height?: number;
  caption: string;
  /** Heading for the first column of the screen-reader table, e.g. "Day". */
  period?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const formatValue = (value: number) => (format === "naira" ? `₦${compact(value)}` : compact(value));
  const max = niceMax(Math.max(...data.map((datum) => datum.value)));
  const peak = data.reduce((best, datum, index) => (datum.value > (data[best]?.value ?? -1) ? index : best), 0);
  const ticks = [max, max / 2, 0];
  // Many columns (a day-by-day month): thinner bars and only every few labels, so none collide.
  const labelEvery = data.length > 12 ? Math.ceil(data.length / 8) : 1;

  return (
    <figure className="w-full">
      <div className="flex gap-3">
        {/* Y axis ticks */}
        <div className="relative w-9 shrink-0 text-right text-[11px] text-muted" style={{ height }} aria-hidden>
          {ticks.map((tick) => (
            <span key={tick} className="absolute right-0 -translate-y-1/2" style={{ top: `${(1 - tick / max) * 100}%` }}>
              {formatValue(tick)}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {/* Recessive hairline grid */}
          <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height }} aria-hidden>
            {ticks.map((tick) => (
              <div key={tick} className="absolute inset-x-0 h-px bg-chart-grid" style={{ top: `${(1 - tick / max) * 100}%` }} />
            ))}
          </div>

          <div className="relative grid" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
            {data.map((datum, index) => {
              const barHeight = (datum.value / max) * height;
              const active = hovered === index;
              return (
                <div
                  key={datum.key}
                  className="relative flex flex-col items-center"
                  onMouseEnter={() => setHovered(index)}
                  onMouseLeave={() => setHovered(null)}
                >
                  {/* Hit target is the whole column, bigger than the mark. */}
                  <div className="relative flex w-full items-end justify-center" style={{ height }}>
                    {active && <div className="absolute inset-x-1 inset-y-0 rounded-lg bg-surface-muted" aria-hidden />}
                    {index === peak && datum.value > 0 && !active && (
                      <span className="absolute text-xs font-semibold text-foreground" style={{ bottom: barHeight + 6 }}>
                        {formatValue(datum.value)}
                      </span>
                    )}
                    {datum.value > 0 && (
                      <div
                        className={cn("relative rounded-t-[4px] bg-chart-bar transition-opacity", hovered !== null && !active && "opacity-50")}
                        style={{ height: Math.max(barHeight, 2), width: "min(24px, 70%)" }}
                      />
                    )}
                    {active && (
                      <div
                        role="tooltip"
                        className="absolute z-10 whitespace-nowrap rounded-lg bg-navy-900 px-2.5 py-1.5 text-xs text-white shadow-pop dark:bg-surface-muted dark:text-foreground"
                        style={{ bottom: barHeight + 10 }}
                      >
                        <span className="font-semibold">{format === "naira" ? `₦${datum.value.toLocaleString("en-NG")}` : datum.value.toLocaleString("en-NG")}</span>{" "}
                        {unit}
                        <span className="block text-[11px] opacity-70">{datum.tooltip ?? datum.label}</span>
                      </div>
                    )}
                  </div>
                  <span className={cn("mt-2.5 whitespace-nowrap text-xs", active ? "font-semibold text-foreground" : "text-muted", !active && index % labelEvery !== 0 && "invisible")}>
                    {datum.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Table view for screen readers. Wrapped, because a table ignores sr-only's 1px width and would widen the page. */}
      <div className="sr-only">
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">{period}</th>
              <th scope="col">{unit}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((datum) => (
              <tr key={datum.key}>
                <th scope="row">{datum.tooltip ?? datum.label}</th>
                <td>{datum.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
