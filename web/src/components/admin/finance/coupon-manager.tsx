"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, TicketPercent, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteCoupon, saveCoupon } from "@/lib/actions/coupons";
import type { Coupon, CouponAppliesTo } from "@/lib/types";
import { cn, formatNaira } from "@/lib/utils";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SelectField, SwitchField, TextField } from "@/components/ui/form";
import { FormButtons } from "@/components/admin/workspace/crud-panel";
import { toKobo, toNaira } from "@/components/admin/workspace/form-controls";

const appliesToLabels: Record<CouponAppliesTo, string> = {
  all: "Everything",
  services: "Business services",
  bookings: "Workspace bookings",
  plans: "Passes and memberships",
};

const stateBadges: Record<Coupon["state"], { tone: "success" | "neutral" | "warning" | "info"; label: string }> = {
  active: { tone: "success", label: "Active" },
  scheduled: { tone: "info", label: "Scheduled" },
  expired: { tone: "neutral", label: "Expired" },
  used_up: { tone: "warning", label: "Used up" },
  off: { tone: "neutral", label: "Off" },
};

/** Nigeria is UTC+1 all year, so a date maps to fixed start and end times there. */
const LAGOS = "+01:00";
const dateInLagos = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" });
const shortDate = new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", day: "numeric", month: "short", year: "numeric" });

function toDateInput(iso: string | null): string {
  return iso ? dateInLagos.format(new Date(iso)) : "";
}

/**
 * Discount codes: the list, with an editor beside it.
 */
export function CouponManager({ coupons }: { coupons: Coupon[] }) {
  const [editingId, setEditingId] = useState<number | "new" | null>(coupons.length === 0 ? "new" : null);
  const [deleting, startDeleting] = useTransition();
  const editing = typeof editingId === "number" ? coupons.find((coupon) => coupon.id === editingId) : undefined;

  function remove(coupon: Coupon) {
    if (!window.confirm(`Delete the code ${coupon.code}?`)) return;
    startDeleting(async () => {
      const result = await deleteCoupon(coupon.id);
      if (result.ok) {
        toast.success(result.message);
        if (editingId === coupon.id) setEditingId(null);
      } else {
        toast.error(result.message ?? "Couldn't delete.");
      }
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
      <Card className="overflow-hidden">
        <CardHeader
          title="Discount codes"
          description="Customers type a code on the payment screen. It comes off the invoice for orders, bookings, passes and memberships."
          action={
            <Button size="sm" onClick={() => setEditingId("new")}>
              <Plus className="size-4" /> New code
            </Button>
          }
        />
        {coupons.length === 0 ? (
          <EmptyState icon={TicketPercent} title="No codes yet" description="Create a code like LAUNCH20 for a promotion, a partner or a referral." />
        ) : (
          <ul className="divide-y divide-border">
            {coupons.map((coupon) => {
              const badge = stateBadges[coupon.state];
              return (
                <li key={coupon.id} className={cn("flex items-center gap-4 px-5 py-4 sm:px-6", editingId === coupon.id && "bg-brand-50/40")}>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold tracking-wider text-foreground">{coupon.code}</span>
                      <Badge tone={badge.tone}>{badge.label}</Badge>
                    </p>
                    <p className="text-sm text-muted">
                      {coupon.label} · {appliesToLabels[coupon.applies_to]}
                      {coupon.min_spend ? ` · min ${formatNaira(coupon.min_spend)}` : ""}
                      {coupon.expires_at ? ` · ends ${shortDate.format(new Date(coupon.expires_at))}` : ""}
                    </p>
                    <p className="text-xs text-muted">
                      Uses: {coupon.uses}
                      {coupon.max_uses ? ` of ${coupon.max_uses}` : ""} · {coupon.paid_uses} paid · {formatNaira(coupon.discount_given)} given
                      {coupon.description ? ` · ${coupon.description}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" className="size-9" onClick={() => setEditingId(coupon.id)} aria-label={`Edit ${coupon.code}`}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-9 hover:bg-danger-soft hover:text-danger" onClick={() => remove(coupon)} disabled={deleting} aria-label={`Delete ${coupon.code}`}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {editingId !== null && (
        <Card key={editingId} className="xl:sticky xl:top-24">
          <CardHeader title={editing ? `Edit ${editing.code}` : "New code"} />
          <div className="p-5">
            <CouponForm coupon={editing} done={() => setEditingId(null)} />
          </div>
        </Card>
      )}
    </div>
  );
}

function CouponForm({ coupon, done }: { coupon?: Coupon; done: () => void }) {
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, startSaving] = useTransition();
  const [form, setForm] = useState({
    code: coupon?.code ?? "",
    description: coupon?.description ?? "",
    discount_type: coupon?.discount_type ?? "percent",
    discount_value: coupon ? (coupon.discount_type === "fixed" ? toNaira(coupon.discount_value) : String(coupon.discount_value)) : "10",
    max_discount: coupon?.max_discount ? toNaira(coupon.max_discount) : "",
    min_spend: coupon?.min_spend ? toNaira(coupon.min_spend) : "",
    applies_to: coupon?.applies_to ?? "all",
    max_uses: coupon?.max_uses ? String(coupon.max_uses) : "",
    max_uses_per_customer: coupon ? (coupon.max_uses_per_customer ? String(coupon.max_uses_per_customer) : "") : "1",
    starts_on: toDateInput(coupon?.starts_at ?? null),
    ends_on: toDateInput(coupon?.expires_at ?? null),
    is_active: coupon?.is_active ?? true,
  });
  const set = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const error = (field: string) => (errors[field] ? [errors[field][0]] : undefined);
  const percent = form.discount_type === "percent";

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startSaving(async () => {
      const result = await saveCoupon(coupon?.id ?? null, {
        code: form.code,
        description: form.description || null,
        discount_type: form.discount_type,
        discount_value: percent ? Number(form.discount_value) : toKobo(form.discount_value),
        max_discount: percent && form.max_discount ? toKobo(form.max_discount) : null,
        min_spend: form.min_spend ? toKobo(form.min_spend) : null,
        applies_to: form.applies_to,
        max_uses: form.max_uses ? Number(form.max_uses) : null,
        max_uses_per_customer: form.max_uses_per_customer ? Number(form.max_uses_per_customer) : null,
        starts_at: form.starts_on ? `${form.starts_on}T00:00:00${LAGOS}` : null,
        expires_at: form.ends_on ? `${form.ends_on}T23:59:59${LAGOS}` : null,
        is_active: form.is_active,
      });
      setErrors(result.errors ?? {});
      if (result.ok) {
        toast.success(result.message);
        done();
      } else {
        toast.error(result.message ?? "Please fix the highlighted fields.");
      }
    });
  }

  return (
    <form noValidate className="space-y-4" onSubmit={submit}>
      <TextField
        label="Code"
        name="code"
        value={form.code}
        onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase().replace(/\s/g, "") }))}
        error={error("code")}
        placeholder="e.g. LAUNCH20"
        inputClassName="font-mono uppercase tracking-wider"
        hint="Letters, numbers, dashes and underscores. Customers can type it in any case."
        autoFocus
      />
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Discount" name="discount_type" value={form.discount_type} onChange={set("discount_type")} error={error("discount_type")}>
          <option value="percent">Percentage</option>
          <option value="fixed">Fixed amount</option>
        </SelectField>
        <TextField
          label={percent ? "Percent off" : "Amount off"}
          name="discount_value"
          inputMode="decimal"
          leading={percent ? "%" : "₦"}
          value={form.discount_value}
          onChange={set("discount_value")}
          error={error("discount_value")}
        />
      </div>
      {percent && (
        <TextField label="Most it can take off (optional)" name="max_discount" leading="₦" inputMode="decimal" value={form.max_discount} onChange={set("max_discount")} error={error("max_discount")} hint="Leave empty for no cap." />
      )}
      <SelectField label="Can be used on" name="applies_to" value={form.applies_to} onChange={set("applies_to")} error={error("applies_to")}>
        {Object.entries(appliesToLabels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </SelectField>
      <TextField label="Minimum spend (optional)" name="min_spend" leading="₦" inputMode="decimal" value={form.min_spend} onChange={set("min_spend")} error={error("min_spend")} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Total uses (optional)" name="max_uses" type="number" min={1} value={form.max_uses} onChange={set("max_uses")} error={error("max_uses")} hint="Empty = no limit." />
        <TextField label="Uses per customer" name="max_uses_per_customer" type="number" min={1} value={form.max_uses_per_customer} onChange={set("max_uses_per_customer")} error={error("max_uses_per_customer")} hint="Empty = no limit." />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Starts on (optional)" name="starts_on" type="date" value={form.starts_on} onChange={set("starts_on")} error={error("starts_at")} />
        <TextField label="Ends on (optional)" name="ends_on" type="date" value={form.ends_on} onChange={set("ends_on")} error={error("expires_at")} hint="Works until the end of this day." />
      </div>
      <TextField label="Note for the team (optional)" name="description" value={form.description} onChange={set("description")} error={error("description")} placeholder="e.g. Launch promo, Instagram" />
      <SwitchField label="Customers can use it" checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} />
      <FormButtons saving={saving} isNew={!coupon} onCancel={done} />
    </form>
  );
}
