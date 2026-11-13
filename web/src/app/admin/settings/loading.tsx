import { PageSkeleton } from "@/components/app/page-skeleton";

/** This section's layout keeps its title and tabs on screen; only the tab's content shows a skeleton. */
export default function Loading() {
  return <PageSkeleton header={false} />;
}
