import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, EmptyState } from "@/components/ui/card";
import { PageHeader } from "./page-header";

/** A section whose data arrives in a later milestone: header plus a helpful empty state. */
export function SectionPlaceholder({
  title,
  description,
  icon,
  emptyTitle,
  emptyDescription,
  action,
  headerActions,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
  action?: ReactNode;
  headerActions?: ReactNode;
}) {
  return (
    <>
      <PageHeader title={title} description={description} actions={headerActions} />
      <Card>
        <EmptyState icon={icon} title={emptyTitle} description={emptyDescription} action={action} className="py-20" />
      </Card>
    </>
  );
}
