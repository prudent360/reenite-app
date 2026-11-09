import { signedPdfResponse } from "@/lib/signed-pdf";

/** A client's signed copy, for Reenite's records. */
export async function GET(_request: Request, { params }: RouteContext<"/files/admin/legal/[id]/signed/[user]">) {
  const { id, user } = await params;
  const document = encodeURIComponent(id);
  return signedPdfResponse(`/admin/legal-documents/${document}/file`, `/admin/legal-documents/${document}/signed/${encodeURIComponent(user)}`);
}
