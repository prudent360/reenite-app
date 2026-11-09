import { NextResponse, type NextRequest } from "next/server";
import { TOKEN_COOKIE } from "@/lib/api";

/** Clears a dead session cookie, then sends the user to sign in and back to where they were. */
export function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next") ?? "";
  const login = new URL("/login", request.url);
  login.searchParams.set("expired", "1");
  // Only same-site app pages, never an external URL.
  if (/^\/(dashboard|admin)(\/|\?|$)/.test(next)) {
    login.searchParams.set("next", next);
  }

  const response = NextResponse.redirect(login);
  response.cookies.delete(TOKEN_COOKIE);
  return response;
}
