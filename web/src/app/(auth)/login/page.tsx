import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthHeading } from "@/components/auth/auth-heading";
import { LoginForm } from "@/components/auth/login-form";
import { FormSkeleton } from "@/components/auth/form-skeleton";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <>
      <AuthHeading title="Welcome back" description="Sign in to track your orders, documents and bookings." />
      <Suspense fallback={<FormSkeleton rows={2} />}>
        <LoginForm searchParams={searchParams} />
      </Suspense>
      <p className="mt-8 text-center text-sm text-muted">
        New to Reenite?{" "}
        <Link href="/register" className="font-semibold text-brand-600 hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
