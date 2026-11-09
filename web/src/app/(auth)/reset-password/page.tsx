import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthHeading } from "@/components/auth/auth-heading";
import { FormSkeleton } from "@/components/auth/form-skeleton";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  return (
    <>
      <AuthHeading title="Set a new password" description="Choose a strong password you haven't used before." />
      <Suspense fallback={<FormSkeleton rows={3} />}>
        <ResetPasswordForm searchParams={searchParams} />
      </Suspense>
    </>
  );
}
