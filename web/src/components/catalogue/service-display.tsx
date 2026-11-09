import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Check, CircleDot, Clock, FileText, Gift, ListChecks, Receipt, ScrollText } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Bundle, Service } from "@/lib/types";
import { formatNaira } from "@/lib/utils";

export function turnaroundLabel(days: number | null): string | null {
  if (!days) {
    return null;
  }
  return days === 1 ? "About 1 working day" : `About ${days} working days`;
}

export function ServiceCard({ service, href }: { service: Service; href: string }) {
  const turnaround = turnaroundLabel(service.turnaround_days);
  return (
    <Link
      href={href}
      className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:border-brand-500/50"
    >
      <h3 className="font-bold text-foreground">{service.name}</h3>
      <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted">{service.summary}</p>
      <div className="mt-5 flex items-end justify-between gap-3 border-t border-border pt-4">
        <div>
          <p className="font-display text-xl font-extrabold text-foreground">{formatNaira(service.total_fee)}</p>
          {service.government_fee > 0 && <p className="text-xs text-muted">incl. {formatNaira(service.government_fee)} government fees</p>}
          {turnaround && (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted">
              <Clock className="size-3.5" /> {turnaround}
            </p>
          )}
        </div>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-foreground transition group-hover:bg-brand-500 group-hover:text-white">
          <ArrowRight className="size-4" />
        </span>
      </div>
    </Link>
  );
}

export function BundleCard({ bundle, action }: { bundle: Bundle; action?: ReactNode }) {
  const saving = (bundle.value_of_services ?? 0) - bundle.price;
  return (
    <div className="rounded-md bg-navy-950 p-7 text-white">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-2.5 py-1 text-xs font-bold">
            <Gift className="size-3.5" /> Bundle
          </span>
          {saving > 0 && <span className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-semibold">Save {formatNaira(saving)}</span>}
        </div>
        <h3 className="mt-4 text-2xl font-bold">{bundle.name}</h3>
        <p className="mt-1.5 text-navy-200">{bundle.summary}</p>
        <ul className="mt-5 space-y-2">
          {bundle.services?.map((service) => (
            <li key={service.id} className="flex items-center gap-2.5 text-sm">
              <Check className="size-4 shrink-0 text-brand-400" strokeWidth={2.5} />
              {service.name}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-display text-3xl font-extrabold">{formatNaira(bundle.price)}</p>
            {saving > 0 && <p className="text-sm text-navy-200 line-through">{formatNaira(bundle.value_of_services ?? 0)}</p>}
          </div>
          {action}
        </div>
      </div>
    </div>
  );
}

/** Full service page body: about, price breakdown, what you'll need, what we'll ask, and the steps. */
export function ServiceDetail({ service, cta }: { service: Service; cta: ReactNode }) {
  const turnaround = turnaroundLabel(service.turnaround_days);
  const documents = service.document_requirements ?? [];
  const fields = service.form_fields ?? [];
  const stages = service.stages ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
      <div className="space-y-6">
        {service.description && service.description !== service.summary && (
          <Card className="p-6">
            <SectionTitle icon={ScrollText}>About this service</SectionTitle>
            <p className="mt-3 whitespace-pre-line leading-relaxed text-muted">{service.description}</p>
          </Card>
        )}

        <Card className="p-6">
          <SectionTitle icon={FileText}>Documents you&apos;ll upload</SectionTitle>
          {documents.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No documents needed for this service.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {documents.map((document) => (
                <li key={document.id ?? document.label} className="flex gap-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <FileText className="size-3.5" />
                  </span>
                  <div>
                    <p className="font-medium text-foreground">
                      {document.label}
                      {!document.is_required && <span className="ml-2 text-xs font-normal text-muted">(optional)</span>}
                    </p>
                    {document.description && <p className="text-sm text-muted">{document.description}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {fields.length > 0 && (
          <Card className="p-6">
            <SectionTitle icon={ListChecks}>Details we&apos;ll ask for</SectionTitle>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {fields.map((field) => (
                <li key={field.key} className="flex items-start gap-2 text-sm text-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand-500" strokeWidth={2.5} />
                  {field.label}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {stages.length > 0 && (
          <Card className="p-6">
            <SectionTitle icon={CircleDot}>How it works</SectionTitle>
            <ol className="mt-5">
              {stages.map((stage, index) => (
                <li key={stage.id ?? stage.name} className="relative flex gap-4 pb-6 last:pb-0">
                  {index < stages.length - 1 && <span className="absolute left-[13px] top-8 h-[calc(100%-24px)] w-0.5 bg-navy-100" aria-hidden />}
                  <span className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-white dark:bg-navy-700">
                    {index + 1}
                  </span>
                  <div className="pt-0.5">
                    <p className="font-semibold text-foreground">{stage.name}</p>
                    {stage.description && <p className="text-sm text-muted">{stage.description}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        )}
      </div>

      <Card className="p-6 lg:sticky lg:top-24">
        <SectionTitle icon={Receipt}>Price</SectionTitle>
        <dl className="mt-4 space-y-2.5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Reenite service fee</dt>
            <dd className="font-medium text-foreground">{formatNaira(service.service_fee)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Government fees</dt>
            <dd className="font-medium text-foreground">{service.government_fee > 0 ? formatNaira(service.government_fee) : "None"}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-border pt-3">
            <dt className="font-semibold text-foreground">Total</dt>
            <dd className="font-display text-2xl font-extrabold text-foreground">{formatNaira(service.total_fee)}</dd>
          </div>
        </dl>
        {turnaround && (
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-surface-muted px-3 py-2.5 text-sm text-foreground">
            <Clock className="size-4 text-brand-500" /> {turnaround}
          </p>
        )}
        <p className="mt-3 text-xs text-muted">Government fees are paid to the agency on your behalf. No hidden charges.</p>
        <div className="mt-5">{cta}</div>
      </Card>
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: typeof Check; children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 text-lg font-bold text-foreground">
      <Icon className="size-5 text-brand-500" />
      {children}
    </h2>
  );
}
