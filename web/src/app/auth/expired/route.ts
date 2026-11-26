import { NextResponse, type NextRequest } from "next/server";
import { STAFF_TOKEN_COOKIE, TOKEN_COOKIE } from "@/lib/api";

/**
 * Clears a dead session cookie, then sends the user to sign in and back to where they were. When staff
 * were signed in as a customer and that ran out, it returns them to their own session instead.
 */
export function GET(request: NextRequest) {
  // A staff member's session as a customer ran out: put their own session back.
  const staffToken = request.cookies.get(STAFF_TOKEN_COOKIE)?.value;
  if (staffToken) {
    const back = NextResponse.redirect(new URL("/admin/customers", request.url));
    back.cookies.set(TOKEN_COOKIE, staffToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    back.cookies.delete(STAFF_TOKEN_COOKIE);
    return back;
  }

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
