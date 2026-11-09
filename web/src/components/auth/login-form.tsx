"use client";

import Link from "next/link";
import { use, useActionState } from "react";
import { AlertCircle, Info } from "lucide-react";
import { login } from "@/lib/actions/auth";
import type { FormState } from "@/lib/types";
import { Alert } from "@/components/ui/card";
import { SubmitButton, TextField } from "@/components/ui/form";

type SearchParams = Promise<{ next?: string; expired?: string; reset?: string }>;

export function LoginForm({ searchParams }: { searchParams: SearchParams }) {
  const { next = "", expired, reset } = use(searchParams);
  const [state, action] = useActionState<FormState, FormData>(login, {});

  return (
    <form action={action} className="space-y-5" noValidate>
      {expired && !state.message && (
        <Alert tone="info" icon={Info}>
          Your session has ended. Please sign in again.
        </Alert>
      )}
      {reset && !state.message && (
        <Alert tone="success" icon={Info}>
          Password updated. Sign in with your new password.
        </Alert>
      )}
      {state.message && (
        <Alert tone="danger" icon={AlertCircle}>
          {state.message}
        </Alert>
      )}

      <input type="hidden" name="next" value={next} />
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
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={state.errors?.password}
        aside={
          <Link href="/forgot-password" className="text-sm font-medium text-brand-600 hover:underline">
            Forgot password?
          </Link>
        }
      />
      <SubmitButton className="w-full" size="lg">
        Sign in
      </SubmitButton>
    </form>
  );
}
