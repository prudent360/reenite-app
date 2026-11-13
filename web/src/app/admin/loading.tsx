import { PageSkeleton } from "@/components/app/page-skeleton";

/** Instant feedback when moving between pages: the sidebar stays, the page area shows a skeleton. */
export default function Loading() {
  return <PageSkeleton />;
}
