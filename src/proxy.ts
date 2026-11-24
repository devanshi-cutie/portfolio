import { NextResponse, type NextRequest } from "next/server";
import { isAdminPreviewMode, sessionCookieName } from "@/core/auth/mode";

/**
 * Optimistic admin gate: a request to /admin/* (except /admin/login) without a
 * session cookie is sent to /admin/login?next=<path>. It only checks that the
 * cookie exists — `requireAdmin()` verifies the signature in every admin page,
 * read and action. Skipped in read-only preview mode.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) return NextResponse.next();
  if (isAdminPreviewMode()) return NextResponse.next();
  if (request.cookies.has(sessionCookieName())) return NextResponse.next();

  const login = request.nextUrl.clone();
  login.pathname = "/admin/login";
  login.search = "";
  login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/admin/:path*"],
};
