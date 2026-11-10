import { proxyFile } from "@/lib/proxy-file";

/** A scan of a customer's own mail. */
export async function GET(_request: Request, { params }: RouteContext<"/files/mail/[id]/scan">) {
  const { id } = await params;
  return proxyFile(`/mailbox/items/${encodeURIComponent(id)}/scan`);
}
