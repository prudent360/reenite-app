import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { CouponManager } from "@/components/admin/finance/coupon-manager";
import { Skeleton } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import type { Coupon, Paginated } from "@/lib/types";

export const metadata: Metadata = { title: "Coupons" };

export default function CouponsPage() {
  return (
    <>
      <PageHeader title="Coupons" description="Discount codes for promotions, partners and referrals." />
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Coupons />
      </Suspense>
    </>
  );
}

async function Coupons() {
  await requireStaff("coupons.manage");
  const { data: coupons } = await api<Paginated<Coupon>>("/admin/finance/coupons");
  return <CouponManager coupons={coupons} />;
}
