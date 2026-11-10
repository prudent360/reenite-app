"use client";

import { useState } from "react";
import { CalendarX2, Plus, Puzzle, Shapes, Ticket, Trash2, Undo2, Users } from "lucide-react";
import type { Addon, AddonChargeType, BookingMode, CancellationPolicy, CancellationRule, Closure, Location, MembershipPlan, PassPlan, Space, SpaceType } from "@/lib/types";
import { cn, formatDateTime, formatNaira } from "@/lib/utils";
import { chargeTypes } from "@/lib/workspace";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SelectField, SwitchField, TextField, TextareaField } from "@/components/ui/form";
import { CrudPanel, FormButtons } from "./crud-panel";
import { ListInput, MultiToggle, toKobo, toNaira, useWorkspaceSave } from "./form-controls";

/* ---------- Add-ons ---------- */

export function AddonManager({ addons, spaces }: { addons: Addon[]; spaces: Space[] }) {
  return (
    <CrudPanel
      kind="addons"
      items={addons}
      title="Add-ons"
      description="Extras customers can add to a booking, like a projector or refreshments."
      newLabel="New add-on"
      emptyIcon={Puzzle}
      emptyTitle="No add-ons yet"
      emptyDescription="Create extras, then switch them on for the spaces that offer them."
      renderRow={(addon) => (
        <>
          <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
            {addon.name} {!addon.is_active && <Badge tone="neutral">Off</Badge>}
          </p>
          <p className="text-sm text-muted">
            {formatNaira(addon.price)} {chargeTypes[addon.charge_type]} · {addon.space_ids?.length ?? 0} space{addon.space_ids?.length === 1 ? "" : "s"}
          </p>
        </>
      )}
      renderForm={(addon, done) => <AddonForm addon={addon} spaces={spaces} done={done} />}
    />
  );
}

function AddonForm({ addon, spaces, done }: { addon?: Addon; spaces: Space[]; done: () => void }) {
  const { save, saving, error } = useWorkspaceSave("addons", addon?.id ?? null);
  const [form, setForm] = useState({
    name: addon?.name ?? "",
    description: addon?.description ?? "",
    price: addon ? toNaira(addon.price) : "",
    charge_type: addon?.charge_type ?? ("per_booking" as AddonChargeType),
    max_quantity: String(addon?.max_quantity ?? 1),
    is_active: addon?.is_active ?? true,
  });
  const [spaceIds, setSpaceIds] = useState<number[]>(addon?.space_ids ?? []);
  const set = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((current) => ({ ...current, [field]: event.target.value }));

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        save({ ...form, description: form.description || null, price: toKobo(form.price), max_quantity: Number(form.max_quantity), space_ids: spaceIds }, done);
      }}
    >
      <TextField label="Name" name="name" value={form.name} onChange={set("name")} error={error("name")} autoFocus />
      <TextareaField label="Description (optional)" name="description" rows={2} value={form.description} onChange={set("description")} error={error("description")} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Price" name="price" leading="₦" inputMode="decimal" value={form.price} onChange={set("price")} error={error("price")} />
        <SelectField label="Charged" name="charge_type" value={form.charge_type} onChange={set("charge_type")} error={error("charge_type")}>
          {Object.entries(chargeTypes).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
      </div>
      <TextField label="Most a customer can add" name="max_quantity" type="number" min={1} value={form.max_quantity} onChange={set("max_quantity")} error={error("max_quantity")} />
      <MultiToggle label="Offered with" options={spaces.map((space) => ({ value: space.id, label: space.name, hint: space.location?.name }))} value={spaceIds} onChange={setSpaceIds} />
      <SwitchField label="Available" checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} />
      <FormButtons saving={saving} isNew={!addon} onCancel={done} />
    </form>
  );
}

/* ---------- Space types ---------- */

export function SpaceTypeManager({ types }: { types: SpaceType[] }) {
  return (
    <CrudPanel
      kind="space-types"
      items={types}
      title="Space types"
      description="Kinds of space. Shared types (hot desks) take many bookings at once up to capacity; exclusive types are booked by one customer at a time."
      newLabel="New type"
      emptyIcon={Shapes}
      emptyTitle="No space types"
      emptyDescription="Add Hot Desk, Private Office, Podcast Studio, Event Space and so on."
      renderRow={(type) => (
        <>
          <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
            {type.name}
            <Badge tone={type.booking_mode === "shared" ? "info" : "navy"}>{type.booking_mode === "shared" ? "Shared seats" : "One booking at a time"}</Badge>
            {!type.is_active && <Badge tone="neutral">Hidden</Badge>}
          </p>
          <p className="text-sm text-muted">
            {type.spaces_count ?? 0} space{type.spaces_count === 1 ? "" : "s"}
            {type.description ? ` · ${type.description}` : ""}
          </p>
        </>
      )}
      renderForm={(type, done) => <SpaceTypeForm type={type} done={done} />}
    />
  );
}

function SpaceTypeForm({ type, done }: { type?: SpaceType; done: () => void }) {
  const { save, saving, error } = useWorkspaceSave("space-types", type?.id ?? null);
  const [form, setForm] = useState({
    name: type?.name ?? "",
    description: type?.description ?? "",
    booking_mode: type?.booking_mode ?? ("exclusive" as BookingMode),
    sort_order: String(type?.sort_order ?? 0),
    is_active: type?.is_active ?? true,
  });
  const set = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((current) => ({ ...current, [field]: event.target.value }));

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        save({ ...form, description: form.description || null, sort_order: Number(form.sort_order) || 0, icon: type?.icon ?? null }, done);
      }}
    >
      <TextField label="Name" name="name" value={form.name} onChange={set("name")} error={error("name")} autoFocus />
      <TextareaField label="Description (optional)" name="description" rows={2} value={form.description} onChange={set("description")} error={error("description")} />
      <fieldset>
        <legend className="text-sm font-medium text-foreground">How it&apos;s booked</legend>
        <div className="mt-2 grid gap-2">
          {(
            [
              ["exclusive", "One booking at a time", "Offices, rooms, studios and halls."],
              ["shared", "Shared seats", "Hot desks: many people book the same time, up to the space's capacity."],
            ] as const
          ).map(([value, label, hint]) => (
            <label key={value} className={cn("flex cursor-pointer gap-3 rounded-xl border p-3 text-sm", form.booking_mode === value ? "border-brand-500 bg-brand-50/50" : "border-border")}>
              <input type="radio" name="booking_mode" value={value} checked={form.booking_mode === value} onChange={() => setForm((current) => ({ ...current, booking_mode: value }))} className="mt-0.5 size-4 accent-[#f05a28]" />
              <span>
                <span className="block font-semibold text-foreground">{label}</span>
                <span className="text-muted">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <TextField label="Order" name="sort_order" type="number" min={0} value={form.sort_order} onChange={set("sort_order")} error={error("sort_order")} />
      <SwitchField label="Shown to customers" checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} />
      <FormButtons saving={saving} isNew={!type} onCancel={done} />
    </form>
  );
}

/* ---------- Cancellation policies ---------- */

export function PolicyManager({ policies }: { policies: CancellationPolicy[] }) {
  return (
    <CrudPanel
      kind="cancellation-policies"
      items={policies}
      title="Cancellation policies"
      description="How much customers get back when they cancel. Each space uses one policy; new spaces start on the default."
      newLabel="New policy"
      emptyIcon={Undo2}
      emptyTitle="No policies yet"
      emptyDescription="Without a policy, cancelled bookings aren't refunded."
      renderRow={(policy) => (
        <>
          <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
            {policy.name} {policy.is_default && <Badge tone="brand">Default</Badge>}
          </p>
          <ul className="text-sm text-muted">
            {policy.summary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-muted">Used by {policy.spaces_count ?? 0} space{policy.spaces_count === 1 ? "" : "s"}</p>
        </>
      )}
      renderForm={(policy, done) => <PolicyForm policy={policy} done={done} />}
    />
  );
}

function PolicyForm({ policy, done }: { policy?: CancellationPolicy; done: () => void }) {
  const { save, saving, errors, error } = useWorkspaceSave("cancellation-policies", policy?.id ?? null);
  const [name, setName] = useState(policy?.name ?? "");
  const [description, setDescription] = useState(policy?.description ?? "");
  const [isDefault, setIsDefault] = useState(policy?.is_default ?? false);
  const [rules, setRules] = useState<{ hours_before: string; refund_percent: string }[]>(
    (policy?.rules ?? ([{ hours_before: 24, refund_percent: 100 }, { hours_before: 0, refund_percent: 0 }] as CancellationRule[])).map((rule) => ({
      hours_before: String(rule.hours_before),
      refund_percent: String(rule.refund_percent),
    })),
  );
  const update = (index: number, patch: Partial<(typeof rules)[number]>) => setRules((current) => current.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        save({ name, description: description || null, is_default: isDefault, rules: rules.map((rule) => ({ hours_before: Number(rule.hours_before), refund_percent: Number(rule.refund_percent) })) }, done);
      }}
    >
      <TextField label="Name" name="name" value={name} onChange={(event) => setName(event.target.value)} error={error("name")} autoFocus />
      <TextareaField label="Description (optional)" name="description" rows={2} value={description} onChange={(event) => setDescription(event.target.value)} error={error("description")} />
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-foreground">Refund rules</legend>
        {rules.map((rule, index) => (
          <div key={index} className="flex items-end gap-2">
            <TextField label="Hours before start" name={`hours-${index}`} type="number" min={0} value={rule.hours_before} onChange={(event) => update(index, { hours_before: event.target.value })} error={error(`rules.${index}.hours_before`)} className="flex-1" />
            <TextField label="Refund %" name={`refund-${index}`} type="number" min={0} max={100} value={rule.refund_percent} onChange={(event) => update(index, { refund_percent: event.target.value })} error={error(`rules.${index}.refund_percent`)} className="w-24" />
            <Button variant="ghost" size="icon" className="mb-0.5 size-10 shrink-0" onClick={() => setRules((current) => current.filter((_, i) => i !== index))} disabled={rules.length === 1} aria-label="Remove rule">
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        {errors.rules && <p className="text-[13px] text-danger">{errors.rules[0]}</p>}
        <Button variant="ghost" size="sm" onClick={() => setRules((current) => [...current, { hours_before: "", refund_percent: "" }])}>
          <Plus className="size-4" /> Add rule
        </Button>
        <p className="text-[13px] text-muted">E.g. 48 hours and 100% means a full refund for cancelling at least 2 days before. Include a 0-hour rule for last-minute cancellations.</p>
      </fieldset>
      <SwitchField label="Default for new spaces" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} />
      <FormButtons saving={saving} isNew={!policy} onCancel={done} />
    </form>
  );
}

/* ---------- Closures ---------- */

/** "2026-12-25T10:00" in Lagos time for a datetime-local input. */
const toLocalInput = (iso: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
};

export function ClosureManager({ closures, locations, spaces }: { closures: Closure[]; locations: Location[]; spaces: Space[] }) {
  return (
    <CrudPanel
      kind="closures"
      items={closures.map((closure) => ({ ...closure, name: closure.reason }))}
      title="Upcoming closures"
      description="Public holidays, maintenance or private events. Nobody can book a closed location or space during these times."
      newLabel="New closure"
      emptyIcon={CalendarX2}
      emptyTitle="No closures planned"
      emptyDescription="Add one for holidays or when a space is out of use."
      itemName={(closure) => `the closure "${closure.reason}"`}
      renderRow={(closure) => (
        <>
          <p className="font-semibold text-foreground">{closure.reason}</p>
          <p className="text-sm text-muted">
            {closure.space ?? `All of ${closure.location}`} · {formatDateTime(closure.starts_at)} to {formatDateTime(closure.ends_at)}
          </p>
        </>
      )}
      renderForm={(closure, done) => <ClosureForm closure={closure} locations={locations} spaces={spaces} done={done} />}
    />
  );
}

function ClosureForm({ closure, locations, spaces, done }: { closure?: Closure; locations: Location[]; spaces: Space[]; done: () => void }) {
  const { save, saving, error } = useWorkspaceSave("closures", closure?.id ?? null);
  const [form, setForm] = useState({
    location_id: String(closure?.location_id ?? locations[0]?.id ?? ""),
    space_id: closure?.space_id ? String(closure.space_id) : "",
    starts_at: closure ? toLocalInput(closure.starts_at) : "",
    ends_at: closure ? toLocalInput(closure.ends_at) : "",
    reason: closure?.reason ?? "",
  });
  const set = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((current) => ({ ...current, [field]: event.target.value, ...(field === "location_id" && { space_id: "" }) }));

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        save({ ...form, location_id: Number(form.location_id), space_id: form.space_id ? Number(form.space_id) : null, starts_at: form.starts_at.replace("T", " "), ends_at: form.ends_at.replace("T", " ") }, done);
      }}
    >
      <TextField label="Reason" name="reason" value={form.reason} onChange={set("reason")} error={error("reason")} placeholder="e.g. Christmas Day" autoFocus />
      <SelectField label="Location" name="location_id" value={form.location_id} onChange={set("location_id")} error={error("location_id")}>
        {locations.map((location) => (
          <option key={location.id} value={location.id}>
            {location.name}
          </option>
        ))}
      </SelectField>
      <SelectField label="What's closed" name="space_id" value={form.space_id} onChange={set("space_id")} error={error("space_id")}>
        <option value="">The whole location</option>
        {spaces
          .filter((space) => String(space.location_id) === form.location_id)
          .map((space) => (
            <option key={space.id} value={space.id}>
              Only {space.name}
            </option>
          ))}
      </SelectField>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="From" name="starts_at" type="datetime-local" value={form.starts_at} onChange={set("starts_at")} error={error("starts_at")} />
        <TextField label="Until" name="ends_at" type="datetime-local" value={form.ends_at} onChange={set("ends_at")} error={error("ends_at")} />
      </div>
      <p className="text-[13px] text-muted">Times are Lagos time.</p>
      <FormButtons saving={saving} isNew={!closure} onCancel={done} />
    </form>
  );
}

/* ---------- Passes and memberships ---------- */

export function PassPlanManager({ plans, types, locations }: { plans: PassPlan[]; types: SpaceType[]; locations: Location[] }) {
  return (
    <CrudPanel
      kind="pass-plans"
      items={plans}
      title="Flexible passes"
      description="Bundles of visits or hours to use within a week or month, like 3 days a week on a hot desk."
      newLabel="New pass"
      emptyIcon={Ticket}
      emptyTitle="No passes yet"
      emptyDescription="Create plans like 3 days a week or 12 days a month."
      renderRow={(plan) => (
        <>
          <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
            {plan.name} {!plan.is_active && <Badge tone="neutral">Off</Badge>}
          </p>
          <p className="text-sm text-muted">
            {formatNaira(plan.price)} a {plan.period} · {plan.allowance} · {plan.space_types?.join(", ")}
            {plan.location ? ` · ${plan.location}` : " · any location"}
          </p>
        </>
      )}
      renderForm={(plan, done) => <PassPlanForm plan={plan} types={types} locations={locations} done={done} />}
    />
  );
}

function PassPlanForm({ plan, types, locations, done }: { plan?: PassPlan; types: SpaceType[]; locations: Location[]; done: () => void }) {
  const { save, saving, error } = useWorkspaceSave("pass-plans", plan?.id ?? null);
  const [form, setForm] = useState({
    name: plan?.name ?? "",
    description: plan?.description ?? "",
    price: plan ? toNaira(plan.price) : "",
    credit_type: plan?.credit_type ?? "visits",
    credits: String(plan?.credits ?? 3),
    period: plan?.period ?? "week",
    location_id: plan?.location_id ? String(plan.location_id) : "",
    is_active: plan?.is_active ?? true,
  });
  const [typeIds, setTypeIds] = useState<number[]>(plan?.space_type_ids ?? types.filter((type) => type.booking_mode === "shared").map((type) => type.id));
  const set = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((current) => ({ ...current, [field]: event.target.value }));

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        save({ ...form, description: form.description || null, price: toKobo(form.price), credits: Number(form.credits), location_id: form.location_id ? Number(form.location_id) : null, space_type_ids: typeIds }, done);
      }}
    >
      <TextField label="Name" name="name" value={form.name} onChange={set("name")} error={error("name")} placeholder="e.g. 3 days a week" autoFocus />
      <div className="grid grid-cols-3 gap-3">
        <TextField label="Allowance" name="credits" type="number" min={1} value={form.credits} onChange={set("credits")} error={error("credits")} />
        <SelectField label="Of" name="credit_type" value={form.credit_type} onChange={set("credit_type")} error={error("credit_type")}>
          <option value="visits">visits</option>
          <option value="hours">hours</option>
        </SelectField>
        <SelectField label="Every" name="period" value={form.period} onChange={set("period")} error={error("period")}>
          <option value="week">week</option>
          <option value="month">month</option>
        </SelectField>
      </div>
      <TextField label={`Price per ${form.period}`} name="price" leading="₦" inputMode="decimal" value={form.price} onChange={set("price")} error={error("price")} />
      <MultiToggle label="Can be used on" options={types.map((type) => ({ value: type.id, label: type.name }))} value={typeIds} onChange={setTypeIds} />
      {error("space_type_ids") && <p className="-mt-2 text-[13px] text-danger">{error("space_type_ids")![0]}</p>}
      <SelectField label="Location" name="location_id" value={form.location_id} onChange={set("location_id")} error={error("location_id")}>
        <option value="">Any location</option>
        {locations.map((location) => (
          <option key={location.id} value={location.id}>
            {location.name}
          </option>
        ))}
      </SelectField>
      <TextareaField label="Description (optional)" name="description" rows={2} value={form.description} onChange={set("description")} error={error("description")} />
      <SwitchField label="On sale" checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} />
      <FormButtons saving={saving} isNew={!plan} onCancel={done} />
    </form>
  );
}

const periodLabels = { month: "month", quarter: "quarter", year: "year" } as const;

export function MembershipManager({ plans, locations }: { plans: MembershipPlan[]; locations: Location[] }) {
  return (
    <CrudPanel
      kind="membership-plans"
      items={plans}
      title="Memberships"
      description="Paid plans that give members a discount on every booking, plus perks. A plan can include a virtual office mailbox."
      newLabel="New membership"
      emptyIcon={Users}
      emptyTitle="No memberships yet"
      emptyDescription="Create tiers like Basic, Pro and Elite."
      renderRow={(plan) => (
        <>
          <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
            {plan.name}
            {plan.is_featured && <Badge tone="brand">Featured</Badge>}
            {plan.mailbox_location_id && <Badge tone="info">Virtual office</Badge>}
            {!plan.is_active && <Badge tone="neutral">Off</Badge>}
          </p>
          <p className="text-sm text-muted">
            {formatNaira(plan.price)} a {periodLabels[plan.billing_period]} · {plan.booking_discount_percent}% off bookings · {plan.perks.length} perk{plan.perks.length === 1 ? "" : "s"}
            {plan.mailbox_location ? ` · mailbox at ${plan.mailbox_location}` : ""}
          </p>
        </>
      )}
      renderForm={(plan, done) => <MembershipForm plan={plan} locations={locations} done={done} />}
    />
  );
}

function MembershipForm({ plan, locations, done }: { plan?: MembershipPlan; locations: Location[]; done: () => void }) {
  const { save, saving, error } = useWorkspaceSave("membership-plans", plan?.id ?? null);
  const [form, setForm] = useState({
    name: plan?.name ?? "",
    description: plan?.description ?? "",
    price: plan ? toNaira(plan.price) : "",
    billing_period: plan?.billing_period ?? "month",
    booking_discount_percent: String(plan?.booking_discount_percent ?? 10),
    sort_order: String(plan?.sort_order ?? 0),
    mailbox_location_id: plan?.mailbox_location_id ? String(plan.mailbox_location_id) : "",
    is_featured: plan?.is_featured ?? false,
    is_active: plan?.is_active ?? true,
  });
  const [perks, setPerks] = useState<string[]>(plan?.perks ?? []);
  const set = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((current) => ({ ...current, [field]: event.target.value }));

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        save({ ...form, description: form.description || null, price: toKobo(form.price), booking_discount_percent: Number(form.booking_discount_percent), sort_order: Number(form.sort_order) || 0, mailbox_location_id: form.mailbox_location_id ? Number(form.mailbox_location_id) : null, perks }, done);
      }}
    >
      <TextField label="Name" name="name" value={form.name} onChange={set("name")} error={error("name")} autoFocus />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Price" name="price" leading="₦" inputMode="decimal" value={form.price} onChange={set("price")} error={error("price")} />
        <SelectField label="Billed every" name="billing_period" value={form.billing_period} onChange={set("billing_period")} error={error("billing_period")}>
          <option value="month">month</option>
          <option value="quarter">quarter</option>
          <option value="year">year</option>
        </SelectField>
      </div>
      <TextField label="Discount on bookings (%)" name="booking_discount_percent" type="number" min={0} max={100} value={form.booking_discount_percent} onChange={set("booking_discount_percent")} error={error("booking_discount_percent")} />
      <ListInput label="Perks" value={perks} onChange={setPerks} placeholder="e.g. 1 free guest pass a month" hint="Shown as a checklist on the website." />
      <SelectField label="Virtual office mailbox" name="mailbox_location_id" value={form.mailbox_location_id} onChange={set("mailbox_location_id")} error={error("mailbox_location_id")}>
        <option value="">No mailbox</option>
        {locations.map((location) => (
          <option key={location.id} value={location.id}>
            Mailbox at {location.name}
          </option>
        ))}
      </SelectField>
      {form.mailbox_location_id && <p className="-mt-2 text-xs text-muted">Members can use this location&apos;s address for their business mail. Their mailbox opens when they pay and stays open while the membership is paid up.</p>}
      <TextareaField label="Description (optional)" name="description" rows={2} value={form.description} onChange={set("description")} error={error("description")} />
      <TextField label="Order" name="sort_order" type="number" min={0} value={form.sort_order} onChange={set("sort_order")} error={error("sort_order")} />
      <SwitchField label="Highlight as most popular" checked={form.is_featured} onChange={(event) => setForm((current) => ({ ...current, is_featured: event.target.checked }))} />
      <SwitchField label="On sale" checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} />
      <FormButtons saving={saving} isNew={!plan} onCancel={done} />
    </form>
  );
}
