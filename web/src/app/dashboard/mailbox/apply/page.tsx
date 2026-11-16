import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, FileCheck2, Mailbox as MailboxIcon, QrCode, ScanLine } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { ApplyForm } from "@/components/mailbox/apply-form";
import { Card, EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireCustomer } from "@/lib/session";
import type { AddressPlan, Business } from "@/lib/types";

export const metadata: Metadata = { title: "Apply for a virtual address" };

const benefits = [
  { icon: FileCheck2, title: "Proof of address", body: "A signed letter you can download and attach to bank, CAC, tax and other applications." },
  { icon: QrCode, title: "Anyone can verify it", body: "The letter carries a QR code and a code that confirm it on our website." },
  { icon: ScanLine, title: "Your mail, handled", body: "We receive your letters and parcels, tell you, and scan, forward or hold them." },
];

export default function ApplyForAddressPage() {
  return (
    <>
      <Link href="/dashboard/mailbox" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Mailbox
      </Link>
      <PageHeader title="Apply for a virtual address" description="Use a Reenite location as your business address, and get a proof-of-address letter for your applications." />
      <ul className="mb-6 grid gap-4 sm:grid-cols-3">
        {benefits.map((benefit) => (
          <li key={benefit.title} className="flex gap-3 rounded-2xl border border-border bg-surface p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
              <benefit.icon className="size-5" />
            </span>
            <span>
              <span className="block font-semibold text-foreground">{benefit.title}</span>
              <span className="mt-0.5 block text-sm text-muted">{benefit.body}</span>
            </span>
          </li>
        ))}
      </ul>
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Application />
      </Suspense>
    </>
  );
}

async function Application() {
  const user = await requireCustomer();
  const [{ data: plans }, businesses] = await Promise.all([
    api<{ data: AddressPlan[] }>("/mailbox/plans"),
    api<{ data: Business[] }>("/businesses").catch(() => ({ data: [] as Business[] })),
  ]);

  if (plans.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={MailboxIcon}
          title="Virtual addresses aren't open for applications yet"
          description="Please check back soon, or contact us and we'll set one up for you."
        />
      </Card>
    );
  }

  // Their registered businesses first, then their own name.
  const suggestions = [...new Set([...businesses.data.map((business) => business.name), user.name])];

  return (
    <Card className="p-5 sm:p-8">
      <ApplyForm plans={plans} suggestions={suggestions} />
    </Card>
  );
}
