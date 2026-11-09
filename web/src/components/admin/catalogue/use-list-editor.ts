"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import type { BuilderResult } from "@/lib/actions/catalogue";
import type { Service } from "@/lib/types";

type Row<T> = T & { uid: string };

let uidCounter = 0;
const nextUid = () => `row-${++uidCounter}`;

const withUids = <T,>(items: T[]): Row<T>[] => items.map((item) => ({ ...item, uid: nextUid() }));

/**
 * State for an ordered list edited in the browser and saved as a whole: add, update, move,
 * remove, unsaved-changes tracking, and API validation errors mapped back to rows.
 */
export function useListEditor<T extends object>({
  initial,
  save,
  fromService,
  errorPrefix,
}: {
  initial: T[];
  save: (items: T[]) => Promise<BuilderResult>;
  /** Pulls this list back out of the saved service (with fresh ids). */
  fromService: (service: Service) => T[];
  /** Key prefix the API uses for row errors, e.g. "fields". */
  errorPrefix: string;
}) {
  const [rows, setRows] = useState<Row<T>[]>(() => withUids(initial));
  const [dirty, setDirty] = useState(false);
  const [rowErrors, setRowErrors] = useState<Record<string, Record<string, string>>>({});
  const [listError, setListError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  // Warn before leaving the page with unsaved edits.
  useEffect(() => {
    if (!dirty) {
      return;
    }
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const change = (next: Row<T>[]) => {
    setRows(next);
    setDirty(true);
  };

  return {
    rows,
    dirty,
    saving,
    listError,
    errorsFor: (uid: string) => rowErrors[uid] ?? {},
    add(item: T): string {
      const uid = nextUid();
      change([...rows, { ...item, uid }]);
      return uid;
    },
    update(uid: string, patch: Partial<T>) {
      change(rows.map((row) => (row.uid === uid ? { ...row, ...patch } : row)));
    },
    remove(uid: string) {
      change(rows.filter((row) => row.uid !== uid));
    },
    move(uid: string, direction: -1 | 1) {
      const index = rows.findIndex((row) => row.uid === uid);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= rows.length) {
        return;
      }
      const next = [...rows];
      [next[index], next[target]] = [next[target]!, next[index]!];
      change(next);
    },
    save() {
      const snapshot = rows;
      startSaving(async () => {
        const result = await save(snapshot.map(({ uid: _uid, ...item }) => item as unknown as T));
        if (result.ok && result.service) {
          setRows(withUids(fromService(result.service)));
          setDirty(false);
          setRowErrors({});
          setListError(null);
          toast.success(result.message);
          return;
        }

        // Map "fields.2.label" style errors onto the row that was at index 2 when saving.
        const mapped: Record<string, Record<string, string>> = {};
        let general: string | null = result.message ?? null;
        for (const [key, messages] of Object.entries(result.errors ?? {})) {
          const match = key.match(new RegExp(`^${errorPrefix}\\.(\\d+)\\.([a-z_]+)`));
          const row = match ? snapshot[Number(match[1])] : undefined;
          if (row && match) {
            mapped[row.uid] = { ...mapped[row.uid], [match[2]!]: messages[0]! };
          } else {
            general = messages[0] ?? general;
          }
        }
        setRowErrors(mapped);
        setListError(general);
        toast.error(general ?? "Some items need attention.");
      });
    },
  };
}
