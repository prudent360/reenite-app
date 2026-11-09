"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Pencil, Plus, Trash2, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { deleteWorkspaceItem, type WorkspaceKind } from "@/lib/actions/workspace";
import { cn } from "@/lib/utils";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DotLoader } from "@/components/ui/loader";

/**
 * A list with an editor beside it: click a row's pencil (or "New") to open the form.
 */
export function CrudPanel<T extends { id: number; name?: string }>({
  kind,
  items,
  title,
  description,
  newLabel,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  itemName = (item) => item.name ?? "this item",
  renderRow,
  renderForm,
}: {
  kind: WorkspaceKind;
  items: T[];
  title: string;
  description?: string;
  newLabel: string;
  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
  itemName?: (item: T) => string;
  renderRow: (item: T) => ReactNode;
  renderForm: (item: T | undefined, done: () => void) => ReactNode;
}) {
  const [editingId, setEditingId] = useState<number | "new" | null>(items.length === 0 ? "new" : null);
  const [deleting, startDeleting] = useTransition();
  const editing = typeof editingId === "number" ? items.find((item) => item.id === editingId) : undefined;

  function remove(item: T) {
    if (!window.confirm(`Delete ${itemName(item)}?`)) return;
    startDeleting(async () => {
      const result = await deleteWorkspaceItem(kind, item.id);
      if (result.ok) {
        toast.success(result.message);
        if (editingId === item.id) setEditingId(null);
      } else {
        toast.error(result.message ?? "Couldn't delete.");
      }
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
      <Card className="overflow-hidden">
        <CardHeader
          title={title}
          description={description}
          action={
            <Button size="sm" onClick={() => setEditingId("new")}>
              <Plus className="size-4" /> {newLabel}
            </Button>
          }
        />
        {items.length === 0 ? (
          <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className={cn("flex items-center gap-4 px-5 py-4 sm:px-6", editingId === item.id && "bg-brand-50/40")}>
                <div className="min-w-0 flex-1">{renderRow(item)}</div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" className="size-9" onClick={() => setEditingId(item.id)} aria-label={`Edit ${itemName(item)}`}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-9 hover:bg-danger-soft hover:text-danger" onClick={() => remove(item)} disabled={deleting} aria-label={`Delete ${itemName(item)}`}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {editingId !== null && (
        <Card key={editingId} className="xl:sticky xl:top-24">
          <CardHeader title={editing ? `Edit ${itemName(editing)}` : newLabel} />
          <div className="p-5">{renderForm(editing, () => setEditingId(null))}</div>
        </Card>
      )}
    </div>
  );
}

/** Save and cancel buttons for the panel forms. */
export function FormButtons({ saving, isNew, onCancel }: { saving: boolean; isNew: boolean; onCancel: () => void }) {
  return (
    <div className="flex gap-2 pt-1">
      <Button type="submit" className="flex-1" disabled={saving}>
        {saving ? <DotLoader className="text-current" /> : isNew ? "Create" : "Save"}
      </Button>
      <Button variant="outline" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
