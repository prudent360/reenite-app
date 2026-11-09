import "server-only";
import { cookies } from "next/headers";
import { API_URL, TOKEN_COOKIE } from "./api";

/**
 * Streams a private file from the API to the signed-in user. The API checks who may see it;
 * this only adds the session token, which never reaches the browser.
 */
export async function proxyFile(apiPath: string): Promise<Response> {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) {
    return new Response("Not found", { status: 404 });
  }

  const upstream = await fetch(`${API_URL}/api/v1${apiPath}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "*/*" },
    cache: "no-store",
  });
  if (!upstream.ok || !upstream.body) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/octet-stream",
      "Content-Disposition": upstream.headers.get("Content-Disposition") ?? "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
