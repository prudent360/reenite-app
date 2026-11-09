"use client";

import { useTransition } from "react";
import { MailWarning } from "lucide-react";
import { toast } from "sonner";
import { resendVerification } from "@/lib/actions/auth";
import { Alert } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DotLoader } from "@/components/ui/loader";

export function VerifyEmailBanner({ email }: { email: string }) {
  const [pending, startTransition] = useTransition();

  function resend() {
    startTransition(async () => {
      const result = await resendVerification();
      if (result.ok) {
        toast.success(result.message);
      } else {
        toast.error(result.message ?? "Couldn't send the link. Please try again shortly.");
      }
    });
  }

  return (
    <Alert
      tone="warning"
      icon={MailWarning}
      title="Please verify your email"
      action={
        <Button variant="outline" size="sm" onClick={resend} disabled={pending} className="sm:ml-auto">
          {pending ? <DotLoader /> : "Resend link"}
        </Button>
      }
    >
      We sent a verification link to <strong>{email}</strong>. You&apos;ll need a verified email before ordering services.
    </Alert>
  );
}
