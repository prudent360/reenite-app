import { Skeleton } from "@/components/ui/loader";

export function FormSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-5">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      ))}
      <Skeleton className="h-13 w-full rounded-xl" />
    </div>
  );
}
