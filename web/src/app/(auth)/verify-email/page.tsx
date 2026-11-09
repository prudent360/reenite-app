import type { Metadata } from "next";
import { Suspense } from "react";
import { CircleCheck, CircleX } from "lucide-react";
import { api } from "@/lib/api";
import { ButtonLink } from "@/components/ui/button";
import { DotLoader } from "@/components/ui/loader";

export const metadata: Metadata = { title: "Verify email" };

export default function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <DotLoader className="scale-150" />
          <p className="text-muted">Verifying your email…</p>
        </div>
      }
    >
      <Verification searchParams={searchParams} />
    </Suspense>
  );
}

const VERIFY_PATH = /^\/api\/v1\/auth\/email\/verify\/\d+\/[a-f0-9]{40}\?/;

async function Verification({ searchParams }: { searchParams: PageProps<"/verify-email">["searchParams"] }) {
  const { link } = await searchParams;
  let verified = false;

  // Only forward links that look exactly like the API's signed verification route.
  if (typeof link === "string" && VERIFY_PATH.test(link)) {
    try {
      await api(link.replace(/^\/api\/v1/, ""), { anonymous: true });
      verified = true;
    } catch {
      verified = false;
    }
  }

  return (
    <div className="flex flex-col items-center text-center">
      <span
        className={`flex size-16 items-center justify-center rounded-2xl ${verified ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}
      >
        {verified ? <CircleCheck className="size-8" /> : <CircleX className="size-8" />}
      </span>
      <h1 className="mt-6 text-3xl font-extrabold">{verified ? "Email verified" : "Link expired or invalid"}</h1>
      <p className="mt-2 max-w-sm text-muted">
        {verified
          ? "Thanks for confirming your email. Your account is fully set up."
          : "Verification links expire after 60 minutes. Sign in and request a new link from your dashboard."}
      </p>
      <ButtonLink href="/dashboard" size="lg" className="mt-8">
        Go to dashboard
      </ButtonLink>
    </div>
  );
}
