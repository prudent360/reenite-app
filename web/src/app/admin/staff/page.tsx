import type { Metadata } from "next";
import { Suspense } from "react";
import { InviteStaffForm } from "@/components/admin/invite-staff-form";
import { StaffRow } from "@/components/admin/staff-row";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import type { User } from "@/lib/types";

export const metadata: Metadata = { title: "Staff & Roles" };

type Role = { name: string; label: string };

export default function StaffPage() {
  return (
    <>
      <PageHeader title="Staff & Roles" description="Invite team members and control what each role can access." />
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <StaffDirectory />
      </Suspense>
    </>
  );
}

async function StaffDirectory() {
  const viewer = await requireStaff("staff.manage");
  const [{ data: staff }, { data: roles }] = await Promise.all([
    api<{ data: User[] }>("/admin/staff"),
    api<{ data: Role[] }>("/admin/meta/staff-roles"),
  ]);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <Card className="overflow-hidden">
        <CardHeader title="Team" description={`${staff.length} staff accounts`} />
        <ul className="divide-y divide-border">
          {staff.map((member) => (
            <StaffRow key={member.id} member={member} roles={roles} isSelf={member.id === viewer.id} />
          ))}
        </ul>
      </Card>

      <div className="space-y-6">
        <InviteStaffForm roles={roles} />
        <Card className="p-5">
          <h2 className="font-bold">What each role can do</h2>
          <dl className="mt-4 space-y-3 text-sm">
            {[
              ["Super Admin", "Everything, including payment settings and staff."],
              ["Operations Manager", "Services, all orders and assignment, workspace, customers, reports."],
              ["Filing Officer", "Orders assigned to them and those customers' documents."],
              ["Front Desk", "Bookings and QR check-in."],
              ["Finance", "Payments, bank-transfer approval, refunds, reports."],
            ].map(([role, access]) => (
              <div key={role}>
                <dt className="font-semibold">{role}</dt>
                <dd className="text-muted">{access}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </div>
  );
}
