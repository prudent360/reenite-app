import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { SectionPlaceholder } from "@/components/app/section-placeholder";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "My Businesses" };

export default function BusinessesPage() {
  return (
    <SectionPlaceholder
      title="My Businesses"
      description="Your registered and in-progress businesses."
      icon={Building2}
      emptyTitle="No businesses yet"
      emptyDescription="Add an existing business or register a new one with CAC. Its documents, people and deadlines will live here."
      action={<ButtonLink href="/dashboard/services">Register a business</ButtonLink>}
    />
  );
}
