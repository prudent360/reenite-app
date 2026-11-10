import { proxyFile } from "@/lib/proxy-file";

/** A mail scan, for the front desk. */
export async function GET(_request: Request, { params }: RouteContext<"/files/admin/mail/[id]/scan">) {
  const { id } = await params;
  return proxyFile(`/admin/mail/items/${encodeURIComponent(id)}/scan`);
}
