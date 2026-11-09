"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { updatePassword, updateProfile } from "@/lib/actions/profile";
import type { FormState, User } from "@/lib/types";
import { Card, CardHeader } from "@/components/ui/card";
import { SubmitButton, TextField } from "@/components/ui/form";

/** Toast the action's message whenever a new result arrives. */
function useResultToast(state: FormState) {
  useEffect(() => {
    if (state.ok && state.message) {
      toast.success(state.message);
    } else if (state.ok === false && state.message) {
      toast.error(state.message);
    }
  }, [state]);
}

export function ProfileForm({ user }: { user: Pick<User, "name" | "email" | "phone"> }) {
  const [state, action] = useActionState<FormState, FormData>(updateProfile, {});
  useResultToast(state);

  return (
    <Card>
      <CardHeader title="Profile" description="How we address you and reach you about your orders." />
      <form action={action} className="space-y-5 p-5 sm:p-6" noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="Full name" name="name" required defaultValue={state.values?.name ?? user.name} error={state.errors?.name} />
          <TextField
            label="Phone"
            name="phone"
            type="tel"
            defaultValue={state.values?.phone ?? user.phone ?? ""}
            error={state.errors?.phone}
            placeholder="+234 801 234 5678"
          />
        </div>
        <TextField label="Email address" name="email_display" type="email" defaultValue={user.email} disabled hint="Contact support to change your email." />
        <div className="flex justify-end">
          <SubmitButton>Save changes</SubmitButton>
        </div>
      </form>
    </Card>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(updatePassword, {});
  const formRef = useRef<HTMLFormElement>(null);
  useResultToast(state);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <Card>
      <CardHeader title="Password" description="Changing your password signs you out on other devices." />
      <form ref={formRef} action={action} className="space-y-5 p-5 sm:p-6" noValidate>
        <TextField
          label="Current password"
          name="current_password"
          type="password"
          autoComplete="current-password"
          required
          error={state.errors?.current_password}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="New password" name="password" type="password" autoComplete="new-password" required error={state.errors?.password} />
          <TextField label="Confirm new password" name="password_confirmation" type="password" autoComplete="new-password" required />
        </div>
        <div className="flex justify-end">
          <SubmitButton variant="navy">Update password</SubmitButton>
        </div>
      </form>
    </Card>
  );
}
