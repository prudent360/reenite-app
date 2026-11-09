import { proxyFile } from "@/lib/proxy-file";

/** A customer's own transfer proof. */
export async function GET(_request: Request, { params }: RouteContext<"/files/payments/[reference]/proof">) {
  const { reference } = await params;
  return proxyFile(`/billing/payments/${encodeURIComponent(reference)}/proof`);
}
