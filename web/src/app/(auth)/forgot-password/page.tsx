import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuthHeading } from "@/components/auth/auth-heading";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthHeading title="Forgot your password?" description="Enter your email and we'll send you a link to set a new one." />
      <ForgotPasswordForm />
      <Link href="/login" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to sign in
      </Link>
    </>
  );
}
