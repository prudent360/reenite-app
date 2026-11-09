"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle } from "lucide-react";
import { register } from "@/lib/actions/auth";
import type { FormState } from "@/lib/types";
import { Alert } from "@/components/ui/card";
import { SubmitButton, TextField } from "@/components/ui/form";

export function RegisterForm() {
  const [state, action] = useActionState<FormState, FormData>(register, {});

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message && (
        <Alert tone="danger" icon={AlertCircle}>
          {state.message}
        </Alert>
      )}
      <TextField
        label="Full name"
        name="name"
        autoComplete="name"
        required
        defaultValue={state.values?.name}
        error={state.errors?.name}
        placeholder="Aniekan Bassey"
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.values?.email}
          error={state.errors?.email}
          placeholder="you@business.com"
        />
        <TextField
          label="Phone (optional)"
          name="phone"
          type="tel"
          autoComplete="tel"
          defaultValue={state.values?.phone}
          error={state.errors?.phone}
          placeholder="+234 801 234 5678"
        />
      </div>
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        error={state.errors?.password}
        hint="At least 8 characters."
      />
      <TextField
        label="Confirm password"
        name="password_confirmation"
        type="password"
        autoComplete="new-password"
        required
      />
      <SubmitButton className="w-full" size="lg">
        Create account
      </SubmitButton>
      <p className="text-center text-xs leading-relaxed text-muted">
        By creating an account you agree to our{" "}
        <Link href="/terms" className="font-semibold text-foreground hover:underline">
          terms of service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="font-semibold text-foreground hover:underline">
          privacy policy
        </Link>
        .
      </p>
      <p className="text-center text-xs text-muted">
        By creating an account you agree to Reenite&apos;s terms of service and privacy policy.
      </p>
    </form>
  );
}
