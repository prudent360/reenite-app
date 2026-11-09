"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { FolderTree, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteCategory, saveCategory } from "@/lib/actions/catalogue";
import type { FormState, ServiceCategory } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CategoryIcon, categoryIcons } from "@/components/catalogue/category-icon";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubmitButton, SwitchField, TextField, TextareaField } from "@/components/ui/form";

export function CategoryManager({ categories }: { categories: ServiceCategory[] }) {
  const [editingId, setEditingId] = useState<number | "new" | null>(categories.length === 0 ? "new" : null);
  const [deleting, startDeleting] = useTransition();
  const editing = typeof editingId === "number" ? categories.find((category) => category.id === editingId) : undefined;

  function remove(category: ServiceCategory) {
    if (!window.confirm(`Delete the "${category.name}" category?`)) {
      return;
    }
    startDeleting(async () => {
      const result = await deleteCategory(category.id);
      if (result.ok) {
        toast.success(result.message);
        if (editingId === category.id) setEditingId(null);
      } else {
        toast.error(result.message ?? "Couldn't delete this category.");
      }
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px] xl:items-start">
      <Card className="overflow-hidden">
        <CardHeader
          title="Categories"
          description="Group services on the website and in the dashboard. Lower order numbers come first."
          action={
            <Button size="sm" onClick={() => setEditingId("new")}>
              <Plus className="size-4" /> New category
            </Button>
          }
        />
        {categories.length === 0 ? (
          <EmptyState icon={FolderTree} title="No categories yet" description="Create one to start adding services." />
        ) : (
          <ul className="divide-y divide-border">
            {categories.map((category) => (
              <li key={category.id} className={cn("flex items-center gap-4 px-5 py-4 sm:px-6", editingId === category.id && "bg-brand-50/40")}>
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-navy-900 text-white dark:bg-navy-700">
                  <CategoryIcon name={category.icon} className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                    {category.name}
                    {!category.is_active && <Badge tone="neutral">Hidden</Badge>}
                  </p>
                  <p className="truncate text-sm text-muted">
                    {category.services_count ?? 0} services · order {category.sort_order}
                    {category.description ? ` · ${category.description}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" className="size-9" onClick={() => setEditingId(category.id)} aria-label={`Edit ${category.name}`}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 hover:bg-danger-soft hover:text-danger"
                    onClick={() => remove(category)}
                    disabled={deleting}
                    aria-label={`Delete ${category.name}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {editingId !== null && (
        <CategoryForm
          key={editingId}
          category={editing}
          nextOrder={categories.length}
          onDone={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

function CategoryForm({ category, nextOrder, onDone }: { category?: ServiceCategory; nextOrder: number; onDone: () => void }) {
  const [state, action] = useActionState<FormState, FormData>(saveCategory.bind(null, category?.id ?? null), {});
  const [icon, setIcon] = useState(category?.icon ?? "briefcase");

  useEffect(() => {
    if (state.ok) {
      toast.success(state.message);
      onDone();
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state, onDone]);

  return (
    <Card className="xl:sticky xl:top-24">
      <CardHeader title={category ? `Edit ${category.name}` : "New category"} />
      <form action={action} className="space-y-5 p-5" noValidate>
        <TextField label="Name" name="name" required defaultValue={state.values?.name ?? category?.name} error={state.errors?.name} autoFocus />
        <TextareaField label="Description (optional)" name="description" rows={2} defaultValue={state.values?.description ?? category?.description ?? ""} error={state.errors?.description} />
        <fieldset>
          <legend className="text-sm font-medium text-foreground">Icon</legend>
          <input type="hidden" name="icon" value={icon} />
          <div className="mt-2 grid grid-cols-5 gap-2">
            {Object.entries(categoryIcons).map(([key, { icon: Icon, label }]) => (
              <button
                key={key}
                type="button"
                onClick={() => setIcon(key)}
                aria-pressed={icon === key}
                title={label}
                aria-label={label}
                className={cn(
                  "flex h-11 items-center justify-center rounded-xl border transition",
                  icon === key ? "border-brand-500 bg-brand-50 text-brand-600" : "border-border text-muted hover:text-foreground",
                )}
              >
                <Icon className="size-5" />
              </button>
            ))}
          </div>
        </fieldset>
        <TextField
          label="Order"
          name="sort_order"
          type="number"
          min={0}
          defaultValue={state.values?.sort_order ?? category?.sort_order ?? nextOrder}
          error={state.errors?.sort_order}
        />
        <SwitchField name="is_active" label="Visible to customers" defaultChecked={category?.is_active ?? true} />
        <div className="flex gap-2">
          <SubmitButton className="flex-1">{category ? "Save category" : "Create category"}</SubmitButton>
          <Button variant="outline" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
