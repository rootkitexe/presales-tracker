// Password gate — optimistic check.
//
// In Next.js 16 "Middleware" was renamed to "Proxy" (same functionality).
// Proxy runs on the Edge runtime, so it does only a fast, optimistic check:
// is an auth cookie present at all? The real verification (cookie value ===
// sha256(APP_PASSWORD)) happens in the Node runtime — see app/page.tsx and the
// /api/records route handlers. This split follows the Next.js guidance that
// Proxy should not be the sole authorization layer.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_COOKIE = 'pt_auth';

export function proxy(request: NextRequest) {
  const hasCookie = !!request.cookies.get(AUTH_COOKIE)?.value;
  if (hasCookie) return NextResponse.next();

  const loginUrl = new URL('/login', request.url);
  if (request.nextUrl.pathname !== '/') {
    loginUrl.searchParams.set('from', request.nextUrl.pathname);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Protect everything except the login page, the login API, and static assets.
  matcher: ['/((?!login|api/login|_next/static|_next/image|favicon.ico).*)'],
};
