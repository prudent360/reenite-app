"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { removeStaffInvite, resendStaffInvite, updateStaff } from "@/lib/actions/admin";
import type { FormState } from "@/lib/types";
import type { User } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DotLoader } from "@/components/ui/loader";
import { formatDate } from "@/lib/utils";

export function StaffRow({ member, roles, isSelf }: { member: User; roles: { name: string; label: string }[]; isSelf: boolean }) {
  const [pending, startTransition] = useTransition();
  const suspended = member.status === "suspended";
  // Never signed in: they haven't used their invite link yet.
  const invitePending = !member.last_login_at && !isSelf;

  function run(action: () => Promise<FormState>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(result.message);
      } else {
        toast.error(result.message ?? "Couldn't update this staff member.");
      }
    });
  }

  const save = (changes: { role?: string; status?: string }) => run(() => updateStaff(member.id, changes));

  function remove() {
    if (!window.confirm(`Remove ${member.name}'s invite? Their link stops working. You can invite them again afterwards, e.g. with the right email.`)) return;
    run(() => removeStaffInvite(member.id));
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
            {invitePending && <Badge tone="warning">Invite pending</Badge>}
          </p>
          <p className="truncate text-xs text-muted">
            {member.email} · {invitePending ? "Hasn't signed in yet" : `Last sign-in ${formatDate(member.last_login_at)}`}
          </p>
          {invitePending && (
            <p className="mt-1 flex gap-3 text-xs font-semibold">
              <button type="button" disabled={pending} onClick={() => run(() => resendStaffInvite(member.id))} className="text-brand-600 hover:underline disabled:opacity-60">
                Resend invite
              </button>
              <button type="button" disabled={pending} onClick={remove} className="text-danger hover:underline disabled:opacity-60">
                Remove
              </button>
            </p>
          )}
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
