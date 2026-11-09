import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Clock, Download, FileText, Mail, Phone, Receipt } from "lucide-react";
import { AssignSelect, DeliverableUpload, ReviewButtons, WorkControls } from "@/components/admin/orders/order-controls";
import { ActivityList, AnswerValue, FileStatus, OrderStatusBadge, ProgressBar } from "@/components/orders/order-parts";
import { MessageThread } from "@/components/orders/order-interactive";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";
import { ApiError, api } from "@/lib/api";
import { can, requireStaff } from "@/lib/session";
import type { Order, OrderFile } from "@/lib/types";
import { cn, formatDate, formatDateTime, formatNaira } from "@/lib/utils";

export default function AdminOrderPage({ params }: PageProps<"/admin/orders/[reference]">) {
  return (
    <>
      <Link href="/admin/orders" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Orders
      </Link>
      <Suspense fallback={<Skeleton className="h-[640px] rounded-2xl" />}>
        {params.then(({ reference }) => (
          <Workspace reference={reference} />
        ))}
      </Suspense>
    </>
  );
}

type Assignee = { id: number; name: string; role: string | null };

async function Workspace({ reference }: { reference: string }) {
  const user = await requireStaff();
  const canAssign = can(user, "orders.assign");
  let order: Order;
  let assignees: Assignee[] = [];
  try {
    const [orderResponse, assigneeResponse] = await Promise.all([
      api<{ data: Order }>(`/admin/orders/${encodeURIComponent(reference)}`),
      canAssign ? api<{ data: Assignee[] }>("/admin/orders/assignees") : Promise.resolve({ data: [] }),
    ]);
    order = orderResponse.data;
    assignees = assigneeResponse.data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const fileHref = (file: OrderFile) => `/files/admin/orders/${order.reference}/${file.id}`;
  const fileQuestions = order.answers?.filter((answer) => answer.type === "file") ?? [];
  const open = order.status !== "completed" && order.status !== "cancelled";
  const reviewItems = [
    ...(order.documents ?? []).map((doc) => ({ key: `r${doc.id}`, label: doc.label, required: doc.is_required, file: doc.file, history: doc.history })),
    ...fileQuestions.map((answer) => ({ key: `f${answer.key}`, label: answer.label, required: answer.is_required, file: answer.file, history: 0 })),
  ];

  return (
    <>
      <title>{`${order.reference} | Reenite Admin`}</title>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-sm text-muted">{order.reference}</p>
          <h1 className="mt-1 text-2xl font-extrabold text-foreground sm:text-3xl">{order.service.name}</h1>
          <div className="mt-2"><OrderStatusBadge order={order} /></div>
        </div>
        {order.due_at && open && (
          <p className={cn("flex items-center gap-2 text-sm", order.is_overdue ? "font-semibold text-danger" : "text-muted")}>
            <Clock className="size-4" /> Due {formatDate(order.due_at)}
          </p>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Customer documents" description="Accept each one, or reject it with a note so the customer can upload a replacement." />
            <ul className="divide-y divide-border">
              {reviewItems.map((item) => (
                <li key={item.key} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">
                      {item.label} {!item.required && <span className="text-xs font-normal text-muted">(optional)</span>}
                    </p>
                    {item.file ? (
                      <p className="text-xs text-muted">
                        <a href={fileHref(item.file)} target="_blank" rel="noreferrer" className="font-medium text-brand-600 hover:underline">{item.file.name}</a>
                        {" · "}{formatDateTime(item.file.created_at)}
                        {item.history > 1 && ` · ${item.history} uploads`}
                      </p>
                    ) : (
                      <p className="text-xs text-muted">Waiting for the customer</p>
                    )}
                    {item.file?.status === "rejected" && item.file.review_note && <p className="mt-1 text-sm text-danger">Rejected: {item.file.review_note}</p>}
                  </div>
                  <FileStatus file={item.file} />
                  {item.file && open && <ReviewButtons reference={order.reference} file={item.file} />}
                </li>
              ))}
              {reviewItems.length === 0 && <li className="px-5 py-6 text-sm text-muted">This service doesn&apos;t ask for documents.</li>}
            </ul>
          </Card>

          <Card>
            <CardHeader title="For the customer" description="Certificates and documents you deliver. They appear in the customer's vault immediately." action={open && order.status !== "awaiting_payment" ? <DeliverableUpload reference={order.reference} /> : undefined} />
            <ul className="divide-y divide-border">
              {(order.deliverables ?? []).map((file) => (
                <li key={file.id} className="flex items-center gap-3 px-5 py-3.5">
                  <FileText className="size-5 shrink-0 text-success" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{file.name}</span>
                  <span className="text-xs text-muted">{formatDate(file.created_at)}</span>
                  <ButtonLink href={fileHref(file)} target="_blank" variant="ghost" size="sm" aria-label={`Download ${file.name}`}><Download className="size-4" /></ButtonLink>
                </li>
              ))}
              {(order.deliverables?.length ?? 0) === 0 && <li className="px-5 py-6 text-sm text-muted">Nothing delivered yet.</li>}
            </ul>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Messages" description="Tick Internal note for comments only staff can see." />
            <MessageThread order={order} viewer="staff" />
          </Card>

          <Card>
            <CardHeader title="Intake answers" />
            <dl className="divide-y divide-border">
              {(order.answers ?? []).map((answer) => (
                <div key={answer.key} className="grid gap-1 px-5 py-3 text-sm sm:grid-cols-[220px_1fr]">
                  <dt className="text-muted">{answer.label}</dt>
                  <dd><AnswerValue answer={answer} fileHref={fileHref} /></dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>

        <div className="space-y-6 xl:sticky xl:top-24">
          <Card className="space-y-5 p-5">
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-foreground">Progress</span>
                <span className="text-muted">{order.progress}%</span>
              </div>
              <div className="mt-2"><ProgressBar value={order.progress} /></div>
            </div>
            {order.status === "awaiting_payment" && <p className="text-sm text-muted">Work can start once the invoice is paid. The order moves to Received automatically.</p>}
            <WorkControls order={order} canCancel={can(user, "orders.manage")} />
          </Card>

          <Card className="space-y-4 p-5">
            <div className="flex items-center gap-3">
              <Avatar name={order.customer?.name ?? "Customer"} />
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{order.customer?.name}</p>
                <p className="text-xs text-muted">Ordered {formatDate(order.created_at)}</p>
              </div>
            </div>
            <div className="space-y-1.5 text-sm">
              {order.customer?.email && <a href={`mailto:${order.customer.email}`} className="flex items-center gap-2 text-foreground hover:text-brand-600"><Mail className="size-4 text-muted" /> {order.customer.email}</a>}
              {order.customer?.phone && <a href={`tel:${order.customer.phone}`} className="flex items-center gap-2 text-foreground hover:text-brand-600"><Phone className="size-4 text-muted" /> {order.customer.phone}</a>}
            </div>
            {canAssign ? <AssignSelect order={order} assignees={assignees} /> : <p className="text-sm text-muted">Officer: <span className="font-medium text-foreground">{order.officer?.name ?? "Unassigned"}</span></p>}
            {order.invoice && (
              <div className="flex items-center justify-between gap-2 border-t border-border pt-4 text-sm">
                {can(user, "invoices.manage") ? (
                  <Link href={`/admin/finance/invoices/${order.invoice.id}`} className="inline-flex items-center gap-2 font-medium text-brand-600 hover:underline">
                    <Receipt className="size-4" /> {order.invoice.number}
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-2 font-medium text-foreground"><Receipt className="size-4" /> {order.invoice.number}</span>
                )}
                <span className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{formatNaira(order.invoice.total)}</span>
                  <Badge tone={order.invoice.status === "paid" ? "success" : order.invoice.status === "void" ? "neutral" : "warning"}>{order.invoice.status === "paid" ? "Paid" : order.invoice.status === "void" ? "Cancelled" : "Unpaid"}</Badge>
                </span>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Timeline" />
            <div className="p-5"><ActivityList events={order.events ?? []} /></div>
          </Card>
        </div>
      </div>
    </>
  );
}
