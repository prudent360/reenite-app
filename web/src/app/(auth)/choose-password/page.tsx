import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthHeading } from "@/components/auth/auth-heading";
import { ChoosePasswordForm } from "@/components/auth/choose-password-form";
import { FormSkeleton } from "@/components/auth/form-skeleton";
import { getOptionalUser, homeFor } from "@/lib/session";

export const metadata: Metadata = { title: "Choose your password" };

export default function ChoosePasswordPage() {
  return (
    <>
      <AuthHeading title="Choose your own password" description="You signed in with a temporary password. Pick one only you know to keep your account safe." />
      <Suspense fallback={<FormSkeleton rows={2} />}>
        <ChoosePassword />
      </Suspense>
    </>
  );
}

async function ChoosePassword() {
  const user = await getOptionalUser();
  if (!user) redirect("/login");
  if (!user.must_change_password) redirect(homeFor(user));
  return <ChoosePasswordForm email={user.email} />;
}
