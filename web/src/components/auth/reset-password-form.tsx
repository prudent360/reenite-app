"use client";

import { use, useActionState } from "react";
import { AlertCircle, CircleCheck } from "lucide-react";
import { resetPassword } from "@/lib/actions/auth";
import type { FormState } from "@/lib/types";
import { Alert } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { SubmitButton, TextField } from "@/components/ui/form";

type SearchParams = Promise<{ token?: string; email?: string }>;

export function ResetPasswordForm({ searchParams }: { searchParams: SearchParams }) {
  const { token = "", email = "" } = use(searchParams);
  const [state, action] = useActionState<FormState, FormData>(resetPassword, {});

  if (state.ok) {
    return (
      <div className="space-y-6">
        <Alert tone="success" icon={CircleCheck}>
          {state.message}
        </Alert>
        <ButtonLink href="/login?reset=1" size="lg" className="w-full">
          Continue to sign in
        </ButtonLink>
      </div>
    );
  }

  if (!token) {
    return (
      <Alert tone="danger" icon={AlertCircle} title="This reset link is incomplete">
        Please use the full link from your email, or request a new one.
      </Alert>
    );
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message && (
        <Alert tone="danger" icon={AlertCircle}>
          {state.message}
        </Alert>
      )}
      <input type="hidden" name="token" value={token} />
      <TextField label="Email address" name="email" type="email" readOnly defaultValue={email} error={state.errors?.email} />
      <TextField
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        error={state.errors?.password}
        hint="At least 8 characters."
      />
      <TextField label="Confirm new password" name="password_confirmation" type="password" autoComplete="new-password" required />
      <SubmitButton className="w-full" size="lg">
        Set new password
      </SubmitButton>
    </form>
  );
}
