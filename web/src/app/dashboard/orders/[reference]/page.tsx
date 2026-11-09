import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, CircleCheck, Clock, Download, FileText, MessagesSquare, PartyPopper, Receipt, UserRound, Wallet } from "lucide-react";
import { ActivityList, AnswerValue, FileStatus, OrderStatusBadge, ProgressBar, StageTracker } from "@/components/orders/order-parts";
import { CancelOrderButton, CustomerUpload, MessageThread } from "@/components/orders/order-interactive";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { ApiError, api } from "@/lib/api";
import { requireCustomer } from "@/lib/session";
import type { Order, OrderFile } from "@/lib/types";
import { cn, formatDate, formatNaira } from "@/lib/utils";

export default function CustomerOrderPage({ params, searchParams }: PageProps<"/dashboard/orders/[reference]">) {
  return (
    <>
      <Link href="/dashboard/orders" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Orders
      </Link>
      <Suspense fallback={<Skeleton className="h-[640px] rounded-2xl" />}>
        <OrderView params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function OrderView({ params, searchParams }: Pick<PageProps<"/dashboard/orders/[reference]">, "params" | "searchParams">) {
  await requireCustomer();
  const [{ reference }, query] = await Promise.all([params, searchParams]);
  let order: Order;
  try {
    ({ data: order } = await api<{ data: Order }>(`/orders/${encodeURIComponent(reference)}`));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const fileHref = (file: OrderFile) => `/files/orders/${order.reference}/${file.id}`;
  const unpaid = order.status === "awaiting_payment" && order.invoice && order.invoice.balance > 0;
  const fileQuestions = order.answers?.filter((answer) => answer.type === "file") ?? [];
  const missingDocs = order.outstanding_documents ?? 0;
  const canUpload = order.status !== "cancelled" && order.status !== "completed";

  return (
    <>
      <title>{`${order.reference} | Reenite`}</title>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-sm text-muted">{order.reference}</p>
          <h1 className="mt-1 text-2xl font-extrabold text-foreground sm:text-3xl">{order.service.name}</h1>
          <div className="mt-2">
            <OrderStatusBadge order={order} />
          </div>
        </div>
        {order.status === "awaiting_payment" && <CancelOrderButton reference={order.reference} />}
      </div>

      <div className="space-y-3">
        {query.new && (
          <Alert tone="success" icon={PartyPopper} title="Order placed!">
            {unpaid || missingDocs ? "Just a couple of steps left: see the checklist below." : "We'll take it from here."}
          </Alert>
        )}
        {order.status === "awaiting_client" && (
          <Alert tone="warning" icon={MessagesSquare} title="Your officer needs something from you">
            Check the latest message below, then reply or upload what&apos;s needed. Your order continues as soon as you respond.
          </Alert>
        )}
        {order.status === "completed" && (
          <Alert tone="success" icon={CircleCheck} title="Order complete">
            Your documents are ready to download below and in your Documents vault.
          </Alert>
        )}
        {order.status === "cancelled" && (
          <Alert tone="info" icon={FileText} title="This order was cancelled">
            {order.cancel_reason}
          </Alert>
        )}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
        <div className="space-y-6">
          {(unpaid || (missingDocs > 0 && canUpload)) && (
            <Card>
              <CardHeader title="To do" />
              <ul className="divide-y divide-border">
                {unpaid && order.invoice && (
                  <li className="flex flex-wrap items-center gap-3 px-5 py-4">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Wallet className="size-5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground">Pay {formatNaira(order.invoice.balance)}</p>
                      <p className="text-sm text-muted">Invoice {order.invoice.number}. Work starts once payment is confirmed.</p>
                    </div>
                    <ButtonLink href={`/dashboard/billing/invoices/${order.invoice.id}`} size="sm">Pay now</ButtonLink>
                  </li>
                )}
                {missingDocs > 0 && canUpload && (
                  <li className="flex flex-wrap items-center gap-3 px-5 py-4">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-navy-50 text-foreground"><FileText className="size-5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground">Upload {missingDocs} document{missingDocs === 1 ? "" : "s"}</p>
                      <p className="text-sm text-muted">See the documents list below.</p>
                    </div>
                  </li>
                )}
              </ul>
            </Card>
          )}

          {order.deliverables && order.deliverables.length > 0 && (
            <Card className="border-success/40">
              <CardHeader title="Your documents from Reenite" />
              <ul className="divide-y divide-border">
                {order.deliverables.map((file) => (
                  <li key={file.id} className="flex items-center gap-3 px-5 py-4">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-success-soft text-success"><FileText className="size-5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-foreground">{file.name}</p>
                      <p className="text-xs text-muted">Added {formatDate(file.created_at)}</p>
                    </div>
                    <ButtonLink href={fileHref(file)} target="_blank" variant="outline" size="sm"><Download className="size-4" /> Download</ButtonLink>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader title="Documents you provide" description="Accepted formats: PDF, Word or a clear photo. Up to 10MB each." />
            <ul className="divide-y divide-border">
              {[...(order.documents ?? []).map((doc) => ({ key: `r${doc.id}`, label: doc.label, description: doc.description, required: doc.is_required, file: doc.file, requirementId: doc.id, fieldKey: undefined as string | undefined })),
                ...fileQuestions.map((answer) => ({ key: `f${answer.key}`, label: answer.label, description: null, required: answer.is_required, file: answer.file, requirementId: undefined as number | undefined, fieldKey: answer.key }))].map((item) => (
                <li key={item.key} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">
                      {item.label} {!item.required && <span className="text-xs font-normal text-muted">(optional)</span>}
                    </p>
                    {item.description && <p className="text-sm text-muted">{item.description}</p>}
                    {item.file && (
                      <a href={fileHref(item.file)} target="_blank" rel="noreferrer" className="text-xs font-medium text-brand-600 hover:underline">{item.file.name}</a>
                    )}
                    {item.file?.status === "rejected" && item.file.review_note && <p className="mt-1 text-sm text-danger">{item.file.review_note}</p>}
                  </div>
                  <FileStatus file={item.file} />
                  {canUpload && item.file?.status !== "accepted" && (
                    <CustomerUpload reference={order.reference} requirementId={item.requirementId} fieldKey={item.fieldKey} label={item.file ? "Replace" : "Upload"} />
                  )}
                </li>
              ))}
              {(order.documents?.length ?? 0) + fileQuestions.length === 0 && <li className="px-5 py-6 text-sm text-muted">No documents needed for this service.</li>}
            </ul>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Messages" description={order.officer ? `With ${order.officer.name}` : "Your officer will reply here"} />
            <MessageThread order={order} viewer="customer" />
          </Card>

          <Card>
            <CardHeader title="Your answers" />
            <dl className="divide-y divide-border">
              {order.answers?.filter((answer) => answer.type !== "file").map((answer) => (
                <div key={answer.key} className="grid gap-1 px-5 py-3 text-sm sm:grid-cols-[220px_1fr]">
                  <dt className="text-muted">{answer.label}</dt>
                  <dd><AnswerValue answer={answer} /></dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>

        <div className="space-y-6 xl:sticky xl:top-24">
          <Card className="p-5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-foreground">Progress</span>
              <span className="text-muted">{order.progress}%</span>
            </div>
            <div className="mt-2"><ProgressBar value={order.progress} /></div>
            {order.due_at && order.status !== "completed" && order.status !== "cancelled" && (
              <p className={cn("mt-3 flex items-center gap-2 text-sm", order.is_overdue ? "text-danger" : "text-muted")}>
                <Clock className="size-4" /> Expected by {formatDate(order.due_at)}
              </p>
            )}
            <div className="mt-5"><StageTracker order={order} /></div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-full bg-navy-900 text-white dark:bg-navy-700"><UserRound className="size-5" /></span>
              <div>
                <p className="font-semibold text-foreground">{order.officer?.name ?? "Officer to be assigned"}</p>
                <p className="text-xs text-muted">Your Reenite officer</p>
              </div>
            </div>
            {order.invoice && (
              <Link href={`/dashboard/billing/invoices/${order.invoice.id}`} className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-sm font-medium text-brand-600 hover:underline">
                <Receipt className="size-4" /> Invoice {order.invoice.number}
              </Link>
            )}
          </Card>

          <Card>
            <CardHeader title="Activity" />
            <div className="p-5"><ActivityList events={order.events ?? []} /></div>
          </Card>
        </div>
      </div>
    </>
  );
}
