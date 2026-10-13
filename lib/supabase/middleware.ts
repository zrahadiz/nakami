import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";

// Routes that must remain reachable without a session.
// Everything else is gated here and re-checked in each route handler: the
// proxy is an optimistic check, not the authorization boundary.
const PUBLIC_ROUTES = [
  "/",
  "/sign-in",
  "/register",
  "/auth/callback",
  "/api/webhooks/paypal",
  "/api/health",
];

const AUTH_ROUTES = ["/sign-in", "/register"];

function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function isAuthRoute(pathname: string) {
  return AUTH_ROUTES.includes(pathname);
}

// Copies the session cookies (and their cache headers) from the response the
// Supabase client last built onto a different response, so a token refresh
// that happened while redirecting is not lost by the browser.
function copySession(response: NextResponse, from: NextResponse) {
  from.cookies.getAll().forEach(({ name, value, ...options }) => {
    response.cookies.set(name, value, options);
  });
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = from.headers.get(header);
    if (value) response.headers.set(header, value);
  }
  return response;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
          // Auth cookies must never be cached by a CDN or reverse proxy.
          for (const [key, value] of Object.entries(headers)) {
            supabaseResponse.headers.set(key, value);
          }
        },
      },
    },
  );

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: getClaims() verifies the token's signature on every call, so
  // server code never trusts the unvalidated cookie contents. (Do not swap in
  // getSession(), which reads the cookie without re-validating it.)
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  if (!user && !isPublicRoute(request.nextUrl.pathname)) {
    // API clients get an explicit 401 instead of an HTML redirect.
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return copySession(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        supabaseResponse,
      );
    }

    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = "";
    url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return copySession(NextResponse.redirect(url), supabaseResponse);
  }

  // Redirect authenticated users away from auth pages
  if (user && isAuthRoute(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    url.search = "";

    return copySession(NextResponse.redirect(url), supabaseResponse);
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you
  // create a new response, copy over the cookies and cache headers first (see
  // copySession above), or the browser and server will go out of sync and the
  // session can terminate prematurely.
  return supabaseResponse;
}
