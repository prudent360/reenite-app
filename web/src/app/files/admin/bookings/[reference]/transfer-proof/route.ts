import { proxyFile } from "@/lib/proxy-file";

/** The transfer receipt waiting to be checked on a booking, for staff who run bookings (enforced by the API). */
export async function GET(_request: Request, { params }: RouteContext<"/files/admin/bookings/[reference]/transfer-proof">) {
  const { reference } = await params;
  return proxyFile(`/admin/bookings/${encodeURIComponent(reference)}/transfer/proof`);
}
