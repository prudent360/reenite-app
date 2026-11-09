"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Check, ChevronDown, Users } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { bookingUrl, spaceTypes, teamSizes } from "@/content/site";
import { cn, formatNaira } from "@/lib/utils";

/**
 * Filters the spaces by type and team size. The homepage search form lands here with
 * `?space=` and `?team=`, which become the starting filters.
 */
export function WorkspaceFinder() {
  const params = useSearchParams();
  const [space, setSpace] = useState(() => (spaceTypes.some((item) => item.slug === params.get("space")) ? params.get("space")! : ""));
  const [team, setTeam] = useState(() => Math.max(1, Number(params.get("team")) || 1));

  const matches = spaceTypes.filter((item) => (!space || item.slug === space) && item.capacity >= team);

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div role="group" aria-label="Space type" className="flex flex-wrap gap-2">
          {[{ slug: "", title: "All spaces" }, ...spaceTypes].map((item) => (
            <button
              key={item.slug}
              type="button"
              aria-pressed={space === item.slug}
              onClick={() => setSpace(item.slug)}
              className={cn(
                "rounded-md border px-4 py-2 text-sm font-semibold transition-colors",
                space === item.slug ? "border-navy-900 bg-navy-900 text-white dark:border-navy-700 dark:bg-navy-700" : "border-border bg-surface text-foreground hover:border-navy-200",
              )}
            >
              {item.title}
            </button>
          ))}
        </div>
        <label className="relative flex items-center gap-2 text-sm font-semibold text-foreground">
          <Users className="size-4 text-muted" />
          <span className="sr-only">Team size</span>
          <select
            value={team}
            onChange={(event) => setTeam(Number(event.target.value))}
            className="h-10 appearance-none rounded-md border border-border bg-surface pl-3 pr-9 font-semibold text-foreground focus:border-brand-500 focus:outline-none"
          >
            {teamSizes.map((size) => (
              <option key={size.value} value={size.value}>
                {size.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 size-4 text-muted" />
        </label>
      </div>

      {matches.length === 0 ? (
        <p className="mt-8 rounded-md border border-border bg-surface p-8 text-center text-muted">
          That space doesn&apos;t fit {team}+ people. Try the event space, which seats up to 70.
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-border overflow-hidden rounded-md border border-border bg-surface">
          {matches.map((item) => (
            <li key={item.slug} id={item.slug} className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                <item.icon className="size-6" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold text-foreground">{item.title}</h3>
                <p className="mt-1 text-muted">{item.description}</p>
                <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
                  <li className="flex items-center gap-1.5">
                    <Users className="size-4" /> Up to {item.capacity} {item.capacity === 1 ? "person" : "people"}
                  </li>
                  {item.extras?.map((extra) => (
                    <li key={extra} className="flex items-center gap-1.5">
                      <Check className="size-4 text-brand-500" /> {extra}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex items-center justify-between gap-6 sm:flex-col sm:items-end sm:gap-3">
                <p className="text-sm text-muted">
                  From <span className="font-display text-2xl font-bold text-foreground">{formatNaira(item.fromHourly)}</span>/hr
                </p>
                {/* Bookings are taken on the separate booking site. */}
                <a href={`${bookingUrl}/book`} className={buttonClasses({ size: "sm" })}>
                  Book
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
