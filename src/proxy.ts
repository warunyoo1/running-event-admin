import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME } from "@/lib/constants";

// Optimistic check only: cookie presence. The JWT is verified by the API
// (`GET /auth/me` in AuthProvider), which is the authoritative guard.
export function proxy(request: NextRequest) {
  if (request.cookies.has(COOKIE_NAME)) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  const login = new URL("/login", request.url);
  login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!login$|login/|api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
