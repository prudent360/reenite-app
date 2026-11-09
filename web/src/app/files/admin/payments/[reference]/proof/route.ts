import { proxyFile } from "@/lib/proxy-file";

/** Any transfer proof, for staff with payments.view (enforced by the API). */
export async function GET(_request: Request, { params }: RouteContext<"/files/admin/payments/[reference]/proof">) {
  const { reference } = await params;
  return proxyFile(`/admin/finance/payments/${encodeURIComponent(reference)}/proof`);
}
