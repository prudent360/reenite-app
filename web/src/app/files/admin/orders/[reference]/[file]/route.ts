import { proxyFile } from "@/lib/proxy-file";

/** Any file on an order the staff member can work on (enforced by the API). */
export async function GET(_request: Request, { params }: RouteContext<"/files/admin/orders/[reference]/[file]">) {
  const { reference, file } = await params;
  return proxyFile(`/admin/orders/${encodeURIComponent(reference)}/files/${encodeURIComponent(file)}`);
}
