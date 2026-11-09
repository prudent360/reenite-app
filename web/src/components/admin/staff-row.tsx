"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { updateStaff } from "@/lib/actions/admin";
import type { User } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DotLoader } from "@/components/ui/loader";
import { formatDate } from "@/lib/utils";

export function StaffRow({ member, roles, isSelf }: { member: User; roles: { name: string; label: string }[]; isSelf: boolean }) {
  const [pending, startTransition] = useTransition();
  const suspended = member.status === "suspended";

  function save(changes: { role?: string; status?: string }) {
    startTransition(async () => {
      const result = await updateStaff(member.id, changes);
      if (result.ok) {
        toast.success(result.message);
      } else {
        toast.error(result.message ?? "Couldn't update this staff member.");
      }
    });
  }

  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={member.name} />
        <div className="min-w-0">
          <p className="flex items-center gap-2 truncate text-sm font-semibold">
            {member.name}
            {isSelf && <Badge tone="brand">You</Badge>}
            {suspended && <Badge tone="danger">Suspended</Badge>}
          </p>
          <p className="truncate text-xs text-muted">
            {member.email} · Last sign-in {formatDate(member.last_login_at)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {pending && <DotLoader />}
        <select
          aria-label={`Role for ${member.name}`}
          defaultValue={member.roles[0]?.name}
          disabled={pending || isSelf}
          onChange={(event) => save({ role: event.target.value })}
          className="h-9 rounded-lg border border-border bg-surface px-2.5 text-sm focus:border-brand-500 focus:outline-none disabled:opacity-60"
        >
          {roles.map((role) => (
            <option key={role.name} value={role.name}>
              {role.label}
            </option>
          ))}
        </select>
        {!isSelf && (
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => save({ status: suspended ? "active" : "suspended" })}
            className={suspended ? "text-success hover:bg-success-soft" : "text-danger hover:bg-danger-soft"}
          >
            {suspended ? "Reactivate" : "Suspend"}
          </Button>
        )}
      </div>
    </li>
  );
}
