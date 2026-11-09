import { proxyFile } from "@/lib/proxy-file";

/** A file on the customer's own order (their uploads and Reenite's deliverables). */
export async function GET(_request: Request, { params }: RouteContext<"/files/orders/[reference]/[file]">) {
  const { reference, file } = await params;
  return proxyFile(`/orders/${encodeURIComponent(reference)}/files/${encodeURIComponent(file)}`);
}
