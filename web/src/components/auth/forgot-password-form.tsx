"use client";

import { useActionState } from "react";
import { AlertCircle, MailCheck } from "lucide-react";
import { forgotPassword } from "@/lib/actions/auth";
import type { FormState } from "@/lib/types";
import { Alert } from "@/components/ui/card";
import { SubmitButton, TextField } from "@/components/ui/form";

export function ForgotPasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(forgotPassword, {});

  if (state.ok) {
    return (
      <Alert tone="success" icon={MailCheck} title="Check your inbox">
        {state.message} The link expires in 60 minutes.
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
      <TextField
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        error={state.errors?.email}
      />
      <SubmitButton className="w-full" size="lg">
        Send reset link
      </SubmitButton>
    </form>
  );
}
