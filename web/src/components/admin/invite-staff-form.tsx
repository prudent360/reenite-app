"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { inviteStaff } from "@/lib/actions/admin";
import type { FormState } from "@/lib/types";
import { Card, CardHeader } from "@/components/ui/card";
import { SelectField, SubmitButton, TextField } from "@/components/ui/form";

export function InviteStaffForm({ roles }: { roles: { name: string; label: string }[] }) {
  const [state, action] = useActionState<FormState, FormData>(inviteStaff, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      toast.success(state.message);
      formRef.current?.reset();
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <Card>
      <CardHeader title="Invite a team member" description="They'll get an email to set their password." />
      <form ref={formRef} action={action} className="space-y-4 p-5" noValidate>
        <TextField label="Full name" name="name" required defaultValue={state.values?.name} error={state.errors?.name} />
        <TextField label="Work email" name="email" type="email" required defaultValue={state.values?.email} error={state.errors?.email} />
        <TextField label="Phone (optional)" name="phone" type="tel" defaultValue={state.values?.phone} error={state.errors?.phone} />
        <SelectField label="Role" name="role" defaultValue={state.values?.role ?? "filing_officer"} error={state.errors?.role}>
          {roles.map((role) => (
            <option key={role.name} value={role.name}>
              {role.label}
            </option>
          ))}
        </SelectField>
        <SubmitButton className="w-full">Send invite</SubmitButton>
      </form>
    </Card>
  );
}
