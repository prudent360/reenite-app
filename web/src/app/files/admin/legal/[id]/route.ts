import { proxyFile } from "@/lib/proxy-file";

/** A legal document as uploaded. */
export async function GET(_request: Request, { params }: RouteContext<"/files/admin/legal/[id]">) {
  const { id } = await params;
  return proxyFile(`/admin/legal-documents/${encodeURIComponent(id)}/file`);
}
