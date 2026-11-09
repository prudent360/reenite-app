import { signedPdfResponse } from "@/lib/signed-pdf";

/** The customer's signed copy, built on download. */
export async function GET(_request: Request, { params }: RouteContext<"/files/agreements/[id]/signed">) {
  const id = encodeURIComponent((await params).id);
  return signedPdfResponse(`/agreements/${id}/file`, `/agreements/${id}/signed`);
}
