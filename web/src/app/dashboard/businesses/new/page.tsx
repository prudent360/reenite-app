import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { BusinessForm } from "@/components/businesses/business-form";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Add a business" };

export default function NewBusinessPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader title="Add a business" description="A few details are enough. You can add the rest later." />
      <Card>
        <BusinessForm />
      </Card>
    </div>
  );
}
