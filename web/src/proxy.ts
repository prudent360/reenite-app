import { NextResponse, type NextRequest } from "next/server";

const TOKEN_COOKIE = "reenite_token";
/** Lets server components know the current page, so an expired session can return the user to it. */
const PATH_HEADER = "x-reenite-path";
const AUTH_PAGES = ["/login", "/register", "/forgot-password", "/reset-password"];

/**
 * Optimistic redirects based on cookie presence only. Real authorization happens
 * in the Data Access Layer (lib/session.ts) and in the Laravel API.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = request.cookies.has(TOKEN_COOKIE);

  if (!hasSession && (pathname.startsWith("/dashboard") || pathname.startsWith("/admin"))) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  if (hasSession && AUTH_PAGES.includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const headers = new Headers(request.headers);
  headers.set(PATH_HEADER, pathname + search);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/login", "/register", "/forgot-password", "/reset-password"],
};
