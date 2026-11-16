import type { Metadata } from "next";
import { Suspense } from "react";
import { BadgeCheck, CircleAlert, SearchX } from "lucide-react";
import { Skeleton } from "@/components/ui/loader";
import { ApiError, api } from "@/lib/api";
import type { AddressVerification } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Check a proof of address", robots: { index: false } };

/**
 * Public page behind the QR code on a proof-of-address letter. A bank, registry or supplier opens it
 * to confirm the letter is genuine and the address is still active. It shows only what the letter shows.
 */
export default function VerifyAddressPage({ params }: PageProps<"/verify/address/[code]">) {
  return (
    <section className="mx-auto max-w-xl px-4 py-12 sm:py-16">
      <p className="text-center text-sm font-semibold text-brand-600">Reenite address check</p>
      <h1 className="mt-2 text-center text-3xl font-bold tracking-tight text-foreground">Proof of address</h1>
      <div className="mt-8">
        <Suspense fallback={<Skeleton className="h-80 rounded-2xl" />}>{params.then(({ code }) => <Result code={code} />)}</Suspense>
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        Compare these details with the letter you were given. If anything differs, treat the letter as not confirmed and contact us at hello@reenite.com.
      </p>
    </section>
  );
}

async function Result({ code }: { code: string }) {
  let record: AddressVerification | null = null;
  let unavailable = false;
  try {
    record = (await api<{ data: AddressVerification }>(`/address-verifications/${encodeURIComponent(code)}`, { anonymous: true, cache: "no-store" })).data;
  } catch (error) {
    unavailable = !(error instanceof ApiError && (error.status === 404 || error.status === 422));
  }

  if (!record) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-danger-soft text-danger">
          <SearchX className="size-7" />
        </span>
        <h2 className="mt-4 text-xl font-bold text-foreground">{unavailable ? "We couldn't check this right now" : "We have no record of this code"}</h2>
        <p className="mt-2 text-muted">
          {unavailable ? "Please try again in a few minutes." : `No Reenite address matches the code "${code.toUpperCase()}". Check that it was typed exactly as printed on the letter.`}
        </p>
      </div>
    );
  }

  const active = record.state === "active";
  const [holder, ...addressLines] = record.address_lines;

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface">
      <header className={`flex items-start gap-4 p-6 sm:p-8 ${active ? "bg-success-soft" : "bg-warning-soft"}`}>
        <span className={`flex size-12 shrink-0 items-center justify-center rounded-full bg-surface ${active ? "text-success" : "text-warning"}`}>
          {active ? <BadgeCheck className="size-6" /> : <CircleAlert className="size-6" />}
        </span>
        <div>
          <h2 className="text-xl font-bold text-foreground">{active ? "Confirmed: this address is active" : record.state === "closed" ? "This address has been closed" : "This address is no longer active"}</h2>
          <p className="mt-1 text-sm text-foreground/80">
            {active
              ? `${record.issuer} confirms the details below as of today.`
              : record.state === "closed"
                ? `${record.issuer} no longer provides this address to the holder below.`
                : "The paid period for this address has ended. A letter showing it should not be relied on until it is renewed."}
          </p>
        </div>
      </header>
      <dl className="divide-y divide-border px-6 sm:px-8">
        <Row label="Address holder" value={<span className="font-semibold">{holder ?? record.holder}</span>} />
        <Row
          label="Address"
          value={addressLines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        />
        <Row label="In use since" value={formatDate(record.valid_from)} />
        <Row label={active ? "Paid up until" : "Paid period ended"} value={record.valid_until ? formatDate(record.valid_until) : "No end date"} />
        <Row label="Letter reference" value={<span className="font-mono text-sm">{record.certificate_number}</span>} />
        <Row label="Issued by" value={record.issuer} />
      </dl>
    </article>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}
