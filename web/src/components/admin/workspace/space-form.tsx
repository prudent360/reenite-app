"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ImagePlus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { deleteWorkspaceItem, removeSpacePhoto, uploadSpacePhoto } from "@/lib/actions/workspace";
import type { Addon, CancellationPolicy, Location, OpeningDay, RateUnit, Space, SpaceType } from "@/lib/types";
import { cn, formatNaira } from "@/lib/utils";
import { chargeTypes, defaultHours, formatMinutes, rateUnits } from "@/lib/workspace";
import { Alert, Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DotLoader } from "@/components/ui/loader";
import { SelectField, SwitchField, TextField, TextareaField } from "@/components/ui/form";
import { HoursEditor, ListInput, MultiToggle, toKobo, toNaira, useWorkspaceSave } from "./form-controls";

type Options = { locations: Location[]; types: SpaceType[]; policies: CancellationPolicy[]; addons: Addon[] };

/** Minutes fields are edited in the unit that reads naturally. */
const durationChoices = [15, 30, 60, 120, 180, 240, 480, 1440, 10080, 43200];

export function SpaceForm({ space, options, defaultLocationId }: { space?: Space; options: Options; defaultLocationId?: number }) {
  const router = useRouter();
  const { save, saving, errors, error } = useWorkspaceSave("spaces", space?.id ?? null);
  const [deleting, startDeleting] = useTransition();
  const defaultPolicy = options.policies.find((policy) => policy.is_default);
  const [form, setForm] = useState({
    name: space?.name ?? "",
    summary: space?.summary ?? "",
    description: space?.description ?? "",
    location_id: String(space?.location_id ?? defaultLocationId ?? options.locations[0]?.id ?? ""),
    space_type_id: String(space?.space_type_id ?? options.types[0]?.id ?? ""),
    cancellation_policy_id: String(space?.cancellation_policy_id ?? defaultPolicy?.id ?? ""),
    capacity: String(space?.capacity ?? 1),
    min_duration_minutes: String(space?.min_duration_minutes ?? 60),
    max_duration_minutes: space?.max_duration_minutes ? String(space.max_duration_minutes) : "",
    buffer_minutes: String(space?.buffer_minutes ?? 15),
    min_notice_minutes: String(space?.min_notice_minutes ?? 60),
    advance_booking_days: String(space?.advance_booking_days ?? 90),
    sort_order: String(space?.sort_order ?? 0),
    is_active: space?.is_active ?? true,
    requires_approval: space?.requires_approval ?? false,
  });
  const [rates, setRates] = useState<Partial<Record<RateUnit, { price: string; is_active: boolean }>>>(() =>
    Object.fromEntries((space?.rates ?? [{ unit: "hour" as RateUnit, price: 0, is_active: true }]).map((rate) => [rate.unit, { price: rate.price ? toNaira(rate.price) : "", is_active: rate.is_active }])),
  );
  const [ownHours, setOwnHours] = useState(Boolean(space && !space.uses_location_hours));
  const [hours, setHours] = useState<OpeningDay[]>(space?.hours ?? options.locations.find((l) => String(l.id) === form.location_id)?.hours ?? defaultHours());
  const [amenities, setAmenities] = useState<string[]>(space?.amenities ?? []);
  const [addonIds, setAddonIds] = useState<number[]>(space?.addons?.map((addon) => addon.id) ?? []);

  const type = options.types.find((t) => String(t.id) === form.space_type_id);
  const shared = type?.booking_mode === "shared";
  const set = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const rateError = (unit: RateUnit) => {
    const index = Object.keys(rates).indexOf(unit);
    return errors[`rates.${index}.price`]?.[0];
  };

  function submit(event: React.FormEvent) {
    event.preventDefault();
    save(
      {
        ...form,
        location_id: Number(form.location_id),
        space_type_id: Number(form.space_type_id),
        cancellation_policy_id: form.cancellation_policy_id ? Number(form.cancellation_policy_id) : null,
        capacity: Number(form.capacity),
        min_duration_minutes: Number(form.min_duration_minutes),
        max_duration_minutes: form.max_duration_minutes ? Number(form.max_duration_minutes) : null,
        buffer_minutes: Number(form.buffer_minutes) || 0,
        min_notice_minutes: Number(form.min_notice_minutes) || 0,
        advance_booking_days: Number(form.advance_booking_days),
        sort_order: Number(form.sort_order) || 0,
        summary: form.summary || null,
        description: form.description || null,
        rates: Object.entries(rates).map(([unit, rate]) => ({ unit, price: toKobo(rate!.price), is_active: rate!.is_active })),
        hours: ownHours ? hours : null,
        amenities,
        addon_ids: addonIds,
      },
      (id) => {
        if (!space) router.push(`/admin/workspace/spaces/${id}`);
      },
    );
  }

  function remove() {
    if (!space || !window.confirm(`Delete ${space.name}? This can't be undone.`)) return;
    startDeleting(async () => {
      const result = await deleteWorkspaceItem("spaces", space.id);
      if (result.ok) {
        toast.success(result.message);
        router.push("/admin/workspace/spaces");
      } else {
        toast.error(result.message ?? "Couldn't delete.");
      }
    });
  }

  const durationSelect = (field: "min_duration_minutes" | "max_duration_minutes", label: string, allowNone = false) => (
    <SelectField label={label} name={field} value={form[field]} onChange={set(field)} error={error(field)}>
      {allowNone && <option value="">No limit</option>}
      {durationChoices.map((minutes) => (
        <option key={minutes} value={minutes}>
          {formatMinutes(minutes)}
        </option>
      ))}
    </SelectField>
  );

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
      <div className="space-y-6">
        {Object.keys(errors).length > 0 && <Alert tone="danger">Some details need attention. Check the highlighted fields.</Alert>}
        <Card>
          <CardHeader title="Details" />
          <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
            <TextField label="Name" name="name" value={form.name} onChange={set("name")} error={error("name")} placeholder="e.g. Podcast Studio" className="sm:col-span-2" />
            <SelectField label="Location" name="location_id" value={form.location_id} onChange={set("location_id")} error={error("location_id")}>
              {options.locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                  {!location.is_active ? " (hidden)" : ""}
                </option>
              ))}
            </SelectField>
            <SelectField label="Type" name="space_type_id" value={form.space_type_id} onChange={set("space_type_id")} error={error("space_type_id")}>
              {options.types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </SelectField>
            <TextField
              label={shared ? "Seats" : "Capacity (people)"}
              name="capacity"
              type="number"
              min={1}
              value={form.capacity}
              onChange={set("capacity")}
              error={error("capacity")}
              hint={shared ? "Shared space: up to this many people can book the same time, each paying per seat." : "Booked by one customer at a time, for up to this many people."}
            />
            <TextField label="Order" name="sort_order" type="number" min={0} value={form.sort_order} onChange={set("sort_order")} error={error("sort_order")} hint="Lower numbers are listed first." />
            <TextField label="Summary (optional)" name="summary" value={form.summary} onChange={set("summary")} error={error("summary")} className="sm:col-span-2" placeholder="One line customers see in listings" />
            <TextareaField label="Description (optional)" name="description" rows={4} value={form.description} onChange={set("description")} error={error("description")} className="sm:col-span-2" />
            <div className="sm:col-span-2">
              <ListInput label="Amenities in this space" value={amenities} onChange={setAmenities} placeholder="e.g. TV screen" hint="Location amenities like WiFi are shown too." />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Prices" description={shared ? "Per seat. Tick the ways customers can book." : "Tick the ways customers can book this space."} />
          <div className="space-y-3 p-5 sm:p-6">
            {errors.rates && <p className="text-[13px] text-danger">{errors.rates[0]}</p>}
            {rateUnits.map(({ unit, label, per }) => {
              const rate = rates[unit];
              return (
                <div key={unit} className={cn("grid items-center gap-3 rounded-xl border p-3 sm:grid-cols-[160px_1fr_auto]", rate ? "border-brand-500/40" : "border-border")}>
                  <label className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
                    <input
                      type="checkbox"
                      checked={Boolean(rate)}
                      onChange={(event) =>
                        setRates((current) => {
                          const next = { ...current };
                          if (event.target.checked) next[unit] = { price: "", is_active: true };
                          else delete next[unit];
                          return next;
                        })
                      }
                      className="size-4 accent-[#f05a28]"
                    />
                    {label}
                  </label>
                  {rate ? (
                    <>
                      <TextField
                        label={`Price per ${per}`}
                        name={`rate-${unit}`}
                        leading="₦"
                        inputMode="decimal"
                        value={rate.price}
                        onChange={(event) => setRates((current) => ({ ...current, [unit]: { ...rate, price: event.target.value } }))}
                        error={rateError(unit) ? [rateError(unit)!] : undefined}
                        placeholder="0"
                      />
                      <label className="flex items-center gap-2 text-sm text-muted">
                        <input type="checkbox" checked={!rate.is_active} onChange={(event) => setRates((current) => ({ ...current, [unit]: { ...rate, is_active: !event.target.checked } }))} className="size-4 accent-[#f05a28]" />
                        Pause
                      </label>
                    </>
                  ) : (
                    <p className="text-sm text-muted sm:col-span-2">Not offered</p>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHeader title="Booking rules" />
          <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
            {durationSelect("min_duration_minutes", "Shortest booking")}
            {durationSelect("max_duration_minutes", "Longest booking", true)}
            <SelectField label="Gap between bookings" name="buffer_minutes" value={form.buffer_minutes} onChange={set("buffer_minutes")} error={error("buffer_minutes")} hint="Time to clean or reset the space.">
              {[0, 15, 30, 60, 120].map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes === 0 ? "None" : formatMinutes(minutes)}
                </option>
              ))}
            </SelectField>
            <SelectField label="Book at least" name="min_notice_minutes" value={form.min_notice_minutes} onChange={set("min_notice_minutes")} error={error("min_notice_minutes")} hint="How far ahead customers must book.">
              {[0, 30, 60, 120, 1440, 2880, 10080].map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes === 0 ? "Any time" : `${formatMinutes(minutes)} ahead`}
                </option>
              ))}
            </SelectField>
            <TextField label="Book up to (days ahead)" name="advance_booking_days" type="number" min={1} value={form.advance_booking_days} onChange={set("advance_booking_days")} error={error("advance_booking_days")} />
            <SelectField label="Cancellation policy" name="cancellation_policy_id" value={form.cancellation_policy_id} onChange={set("cancellation_policy_id")} error={error("cancellation_policy_id")} hint={options.policies.find((p) => String(p.id) === form.cancellation_policy_id)?.summary.join(". ")}>
              <option value="">No refunds</option>
              {options.policies.map((policy) => (
                <option key={policy.id} value={policy.id}>
                  {policy.name}
                </option>
              ))}
            </SelectField>
          </div>
        </Card>

        <Card>
          <CardHeader title="Opening hours" />
          <div className="space-y-4 p-5 sm:p-6">
            <SwitchField label="Use the location's hours" description="Turn off to give this space its own hours, for example a studio that closes earlier." checked={!ownHours} onChange={(event) => setOwnHours(!event.target.checked)} />
            {ownHours && <HoursEditor value={hours} onChange={setHours} errors={errors} />}
          </div>
        </Card>

        {options.addons.length > 0 && (
          <Card>
            <CardHeader title="Add-ons" description="Extras customers can add when booking this space." />
            <div className="p-5 sm:p-6">
              <MultiToggle
                label="Available add-ons"
                options={options.addons.map((addon) => ({ value: addon.id, label: addon.name, hint: `${formatNaira(addon.price)} ${chargeTypes[addon.charge_type]}` }))}
                value={addonIds}
                onChange={setAddonIds}
              />
            </div>
          </Card>
        )}
      </div>

      <div className="space-y-6 xl:sticky xl:top-24">
        <Card className="space-y-5 p-5">
          <SwitchField label="Open for booking" description="Off hides this space from customers." checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} />
          <SwitchField label="Needs approval" description="Bookings wait for a staff member to approve before payment." checked={form.requires_approval} onChange={(event) => setForm((current) => ({ ...current, requires_approval: event.target.checked }))} />
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? <DotLoader className="text-current" /> : space ? "Save space" : "Create space"}
          </Button>
          {space && (
            <button type="button" onClick={remove} disabled={deleting} className="inline-flex items-center gap-1.5 text-sm font-medium text-danger hover:underline">
              <Trash2 className="size-4" /> Delete space
            </button>
          )}
        </Card>
        {space ? (
          <PhotoCard space={space} />
        ) : (
          <Card className="p-5 text-sm text-muted">
            <Users className="mb-2 size-5" /> Add a photo after creating the space.
          </Card>
        )}
      </div>
    </form>
  );
}

function PhotoCard({ space }: { space: Space }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.set("photo", file);
    startTransition(async () => {
      const result = await uploadSpacePhoto(space.id, formData);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message ?? "Upload failed.");
      if (input.current) input.current.value = "";
    });
  }

  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-[3/2] bg-surface-muted">
        {space.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- served by the API's public storage
          <img src={space.photo_url} alt={space.name} className="size-full object-cover" />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-sm text-muted">
            <ImagePlus className="size-8" /> No photo yet
          </div>
        )}
        {pending && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface/70">
            <DotLoader />
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 p-4">
        <p className="text-xs text-muted">JPG, PNG or WebP, at least 600 x 400, up to 5MB.</p>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={upload} tabIndex={-1} aria-hidden />
        <div className="flex shrink-0 gap-1">
          <Button variant="outline" size="sm" onClick={() => input.current?.click()} disabled={pending}>
            {space.photo_url ? "Replace" : "Upload"}
          </Button>
          {space.photo_url && (
            <Button
              variant="ghost"
              size="sm"
              aria-label="Remove photo"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await removeSpacePhoto(space.id);
                  if (result.ok) toast.success(result.message);
                })
              }
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
