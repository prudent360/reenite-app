"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardHeader } from "@/components/ui/card";
import { SwitchField } from "@/components/ui/form";
import { setRolePermission } from "@/lib/actions/admin";
import type { RolePermission } from "@/lib/types";

const descriptions: Record<string, string> = {
  "customers.create": "Shows an Add customer button on the Customers page. Super Admins can always add customers.",
};

/** Switches for the permissions Super Admins can give or take away per role. Each change saves straight away. */
export function RolePermissionsCard({ permissions }: { permissions: RolePermission[] }) {
  return (
    <>
      {permissions.map((permission) => (
        <PermissionCard key={permission.name} permission={permission} />
      ))}
    </>
  );
}

function PermissionCard({ permission }: { permission: RolePermission }) {
  const [pending, startTransition] = useTransition();
  const [roles, setOptimisticRoles] = useOptimistic(permission.roles);

  function toggle(name: string, granted: boolean) {
    const next = roles.map((role) => (role.name === name ? { ...role, granted } : role));
    startTransition(async () => {
      setOptimisticRoles(next);
      const result = await setRolePermission(
        permission.name,
        next.filter((role) => role.granted).map((role) => role.name),
      );
      if (result.ok) toast.success(result.message);
      else toast.error(result.message ?? "Couldn't save that change.");
    });
  }

  return (
    <Card>
      <CardHeader title={`Who can ${permission.label.toLowerCase()}`} description={descriptions[permission.name]} />
      <div className="space-y-4 p-5" aria-busy={pending}>
        {roles.map((role) => (
          <SwitchField
            key={role.name}
            label={role.label}
            checked={role.granted}
            disabled={pending}
            onChange={(event) => toggle(role.name, event.target.checked)}
          />
        ))}
      </div>
    </Card>
  );
}
