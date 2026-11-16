import { cookies } from "next/headers";
import { buildAddressLetter } from "@/lib/address-letter";
import { API_URL, TOKEN_COOKIE } from "@/lib/api";
import type { AddressCertificate } from "@/lib/types";

/** The customer's proof-of-address letter, built on download. Anything the API refuses comes back as a 404. */
export async function GET(_request: Request, { params }: RouteContext<"/files/mailbox/[id]/certificate">) {
  const id = encodeURIComponent((await params).id);
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) return new Response("Not found", { status: 404 });

  const response = await fetch(`${API_URL}/api/v1/mailbox/${id}/certificate`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, cache: "no-store" });
  if (!response.ok) return new Response("Not found", { status: 404 });

  const { data } = (await response.json()) as { data: AddressCertificate };
  const bytes = await buildAddressLetter(data);

  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Reenite-proof-of-address-${data.mailbox_number}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
