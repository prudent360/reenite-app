import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { OpenMailboxForm } from "@/components/admin/mail/mailbox-forms";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import type { Location } from "@/lib/types";

export const metadata: Metadata = { title: "Open a mailbox" };

export default function NewMailboxPage() {
  return (
    <>
      <PageHeader title="Open a mailbox" description="For customers who arranged a virtual office with you directly. Memberships with a mailbox open one automatically when paid." />
      <Suspense fallback={<Skeleton className="h-96 max-w-xl rounded-2xl" />}>
        <NewMailbox />
      </Suspense>
    </>
  );
}

async function NewMailbox() {
  await requireStaff("mail.manage");
  const { data: locations } = await api<{ data: Location[] }>("/admin/mail/locations");
  return (
    <Card className="max-w-xl p-5 sm:p-6">
      <OpenMailboxForm locations={locations} />
    </Card>
  );
}
