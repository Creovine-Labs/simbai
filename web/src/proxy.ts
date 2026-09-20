import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "simbai_session";

/**
 * Runs before every page render to attach a per-request CSP nonce and to keep
 * signed-out visitors off the dashboard.
 *
 * The cookie check here is deliberately optimistic — Proxy is not the place for
 * session lookups. Every route handler still authenticates for real.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/" && !hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";

  const csp = [
    `default-src 'self'`,
    // 'unsafe-eval' is only needed for React's development error overlay.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Tailwind and next/font emit style tags Next cannot nonce individually.
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com`,
    `img-src 'self' blob: data: https:`,
    // Firebase sign-in and the same-origin document viewer.
    `connect-src 'self' https://*.googleapis.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com`,
    `frame-src 'self' https://*.firebaseapp.com https://accounts.google.com`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Next reads the nonce back off the request header to stamp its own script
  // tags, so this has to be set on both the request and the response.
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    /*
     * Pages only. Route handlers set their own headers, and static assets do
     * not need a nonce.
     */
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
