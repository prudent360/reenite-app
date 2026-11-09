import type { Metadata } from "next";
import { MessagesSquare } from "lucide-react";
import { SectionPlaceholder } from "@/components/app/section-placeholder";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Messages" };

export default function MessagesPage() {
  return (
    <SectionPlaceholder
      title="Messages"
      description="Talk to your Reenite officer."
      icon={MessagesSquare}
      emptyTitle="No conversations yet"
      emptyDescription="Each order gets its own thread with your assigned officer. For anything else, email hello@reenite.com."
      action={<ButtonLink href="mailto:hello@reenite.com" variant="outline">Email Reenite</ButtonLink>}
    />
  );
}
