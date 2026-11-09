"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteWorkspaceItem } from "@/lib/actions/workspace";
import type { Location, OpeningDay } from "@/lib/types";
import { defaultHours } from "@/lib/workspace";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DotLoader } from "@/components/ui/loader";
import { SwitchField, TextField, TextareaField } from "@/components/ui/form";
import { HoursEditor, ListInput, useWorkspaceSave } from "./form-controls";

export function LocationForm({ location }: { location?: Location }) {
  const router = useRouter();
  const { save, saving, errors, error } = useWorkspaceSave("locations", location?.id ?? null);
  const [deleting, startDeleting] = useTransition();
  const [form, setForm] = useState({
    name: location?.name ?? "",
    address: location?.address ?? "",
    city: location?.city ?? "Uyo",
    state: location?.state ?? "Akwa Ibom State",
    phone: location?.phone ?? "",
    email: location?.email ?? "",
    description: location?.description ?? "",
    sort_order: String(location?.sort_order ?? 0),
    is_active: location?.is_active ?? true,
  });
  const [hours, setHours] = useState<OpeningDay[]>(location?.hours ?? defaultHours());
  const [amenities, setAmenities] = useState<string[]>(location?.amenities ?? ["High-speed WiFi", "Steady power"]);
  const set = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((current) => ({ ...current, [field]: event.target.value }));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    save({ ...form, phone: form.phone || null, email: form.email || null, description: form.description || null, sort_order: Number(form.sort_order) || 0, hours, amenities }, (id) => {
      if (!location) router.push(`/admin/workspace/locations/${id}`);
    });
  }

  function remove() {
    if (!location || !window.confirm(`Delete ${location.name}? This can't be undone.`)) return;
    startDeleting(async () => {
      const result = await deleteWorkspaceItem("locations", location.id);
      if (result.ok) {
        toast.success(result.message);
        router.push("/admin/workspace");
      } else {
        toast.error(result.message ?? "Couldn't delete.");
      }
    });
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
      <div className="space-y-6">
        <Card>
          <CardHeader title="Details" />
          <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
            <TextField label="Name" name="name" value={form.name} onChange={set("name")} error={error("name")} placeholder="Reenite Uyo" className="sm:col-span-2" />
            <TextField label="Street address" name="address" value={form.address} onChange={set("address")} error={error("address")} className="sm:col-span-2" />
            <TextField label="City" name="city" value={form.city} onChange={set("city")} error={error("city")} />
            <TextField label="State" name="state" value={form.state} onChange={set("state")} error={error("state")} />
            <TextField label="Phone (optional)" name="phone" type="tel" value={form.phone} onChange={set("phone")} error={error("phone")} />
            <TextField label="Email (optional)" name="email" type="email" value={form.email} onChange={set("email")} error={error("email")} />
            <TextareaField label="Description (optional)" name="description" rows={3} value={form.description} onChange={set("description")} error={error("description")} className="sm:col-span-2" />
            <div className="sm:col-span-2">
              <ListInput label="Amenities" value={amenities} onChange={setAmenities} placeholder="e.g. Parking on site" hint="Shown on every space at this location." />
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Opening hours" description="Spaces follow these unless you give a space its own hours. Times are Lagos time." />
          <div className="p-5 sm:p-6">
            <HoursEditor value={hours} onChange={setHours} errors={errors} />
          </div>
        </Card>
      </div>

      <Card className="space-y-5 p-5 xl:sticky xl:top-24">
        <SwitchField label="Open for booking" description="Off hides the location and all its spaces from customers." checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} />
        <TextField label="Order" name="sort_order" type="number" min={0} value={form.sort_order} onChange={set("sort_order")} error={error("sort_order")} hint="Lower numbers are listed first." />
        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? <DotLoader className="text-current" /> : location ? "Save location" : "Create location"}
        </Button>
        {location && (
          <button type="button" onClick={remove} disabled={deleting} className="inline-flex items-center gap-1.5 text-sm font-medium text-danger hover:underline">
            <Trash2 className="size-4" /> Delete location
          </button>
        )}
      </Card>
    </form>
  );
}
