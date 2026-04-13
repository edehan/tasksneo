import { type NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "tfses_session";
const SESSION_TOKEN_PREFIX = "tfses_";

// Routes that are accessible without a session
const AUTH_ROUTES = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
]);

function hasValidSession(request: NextRequest): boolean {
  const cookie = request.cookies.get(SESSION_COOKIE_NAME);
  return cookie?.value?.startsWith(SESSION_TOKEN_PREFIX) ?? false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authenticated = hasValidSession(request);

  // Public landing page — always accessible
  if (pathname === "/") {
    return NextResponse.next();
  }

  // Admin panel — own auth via ADMIN_TOKEN header, not cookie
  if (pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  // Auth pages: redirect already-authenticated users to dashboard
  for (const route of AUTH_ROUTES) {
    if (pathname.startsWith(route)) {
      if (authenticated) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
      return NextResponse.next();
    }
  }

  // Protected app routes: redirect unauthenticated users to login
  if (!authenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except Next.js internals and static assets
    "/((?!_next/static|_next/image|favicon.ico|icon-192.png|apple-touch-icon.png|manifest.json|register-sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
