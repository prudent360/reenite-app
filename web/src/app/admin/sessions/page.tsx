import type { Metadata } from "next";
import { Suspense } from "react";
import { SessionMonitorView } from "@/components/admin/sessions/session-monitor";
import { PageSkeleton } from "@/components/app/page-skeleton";
import { api } from "@/lib/api";
import { can, requireStaff } from "@/lib/session";
import type { SessionMonitor } from "@/lib/types";

export const metadata: Metadata = { title: "Session monitor" };

export default function SessionMonitorPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Monitor />
    </Suspense>
  );
}

async function Monitor() {
  const user = await requireStaff("bookings.manage");
  const { data } = await api<{ data: SessionMonitor }>("/admin/bookings/monitor");

  return <SessionMonitorView data={data} canManage={can(user, "bookings.manage")} />;
}
