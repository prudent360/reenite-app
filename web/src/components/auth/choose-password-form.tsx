"use client";

import { useActionState } from "react";
import { AlertCircle } from "lucide-react";
import { logout } from "@/lib/actions/auth";
import { chooseOwnPassword } from "@/lib/actions/profile";
import type { FormState } from "@/lib/types";
import { Alert } from "@/components/ui/card";
import { SubmitButton, TextField } from "@/components/ui/form";

export function ChoosePasswordForm({ email }: { email: string }) {
  const [state, action] = useActionState<FormState, FormData>(chooseOwnPassword, {});

  return (
    <div className="space-y-5">
      <form action={action} className="space-y-5" noValidate>
        {state.message && (
          <Alert tone="danger" icon={AlertCircle}>
            {state.message}
          </Alert>
        )}
        {/* Lets password managers save the new password against the right account. */}
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
        <TextField label="New password" name="password" type="password" autoComplete="new-password" required error={state.errors?.password} hint="At least 8 characters, with letters and numbers." />
        <TextField label="Confirm new password" name="password_confirmation" type="password" autoComplete="new-password" required />
        <SubmitButton className="w-full" size="lg">
          Save and continue
        </SubmitButton>
      </form>
      <form action={signOut} className="text-center">
        <button type="submit" className="text-sm font-semibold text-muted hover:text-foreground">
          Not {email}? Sign out
        </button>
      </form>
    </div>
  );
}

async function signOut() {
  await logout();
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign("/login");
}
