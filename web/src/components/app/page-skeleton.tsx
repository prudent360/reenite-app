import { Skeleton } from "@/components/ui/loader";

/**
 * Shown the instant someone opens a dashboard page, while its data loads. Shaped like a typical
 * page (title, a row of tiles, a list) so the content doesn't jump much when it arrives.
 * `header={false}` inside sections whose layout already draws the title and tabs.
 */
export function PageSkeleton({ header = true }: { header?: boolean }) {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">Loading</span>
      {header && (
        <div className="space-y-2.5">
          <Skeleton className="h-8 w-56 max-w-[70%]" />
          <Skeleton className="h-4 w-96 max-w-[90%]" />
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((tile) => (
          <Skeleton key={tile} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="border-b border-border p-5">
          <Skeleton className="h-5 w-40" />
        </div>
        <ul className="divide-y divide-border">
          {[0, 1, 2, 3, 4].map((row) => (
            <li key={row} className="flex items-center gap-4 px-5 py-4">
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="hidden h-4 w-20 sm:block" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
