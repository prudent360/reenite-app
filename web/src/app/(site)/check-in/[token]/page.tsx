import type { Metadata } from "next";
import { Suspense } from "react";
import { MapPin } from "lucide-react";
import { SelfCheckInPanel } from "@/components/check-in/self-check-in-panel";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { ApiError, api } from "@/lib/api";
import type { SelfCheckInPage } from "@/lib/types";

export const metadata: Metadata = { title: "Check in", robots: { index: false } };

/** Opened by scanning the QR poster at a location's reception. */
export default function SelfCheckInRoute({ params }: PageProps<"/check-in/[token]">) {
  return (
    <section className="mx-auto max-w-lg px-4 py-10 sm:px-6 sm:py-16">
      <Suspense fallback={<Skeleton className="h-[420px] rounded-3xl" />}>
        {params.then(({ token }) => (
          <CheckIn token={token} />
        ))}
      </Suspense>
    </section>
  );
}

async function CheckIn({ token }: { token: string }) {
  let page: SelfCheckInPage;
  try {
    ({ data: page } = await api<{ data: SelfCheckInPage }>(`/check-in/${encodeURIComponent(token)}`));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <Card className="p-8 text-center">
          <span className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-surface-muted text-muted">
            <MapPin className="size-6" />
          </span>
          <h1 className="text-xl font-bold text-foreground">Please check in at the front desk</h1>
          <p className="mt-2 text-sm text-muted">This check-in link isn&apos;t working any more. Our team at reception will check you in with your booking code.</p>
        </Card>
      );
    }
    throw error;
  }

  return <SelfCheckInPanel token={token} page={page} />;
}
