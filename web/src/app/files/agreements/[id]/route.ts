import { proxyFile } from "@/lib/proxy-file";

/** The document as uploaded, for the customer to read before signing. */
export async function GET(_request: Request, { params }: RouteContext<"/files/agreements/[id]">) {
  const { id } = await params;
  return proxyFile(`/agreements/${encodeURIComponent(id)}/file`);
}
