// Single shared-password gate.
//
// There are no user accounts. Anyone with the shared password (APP_PASSWORD)
// gets full access. On a correct password, /api/login sets an httpOnly cookie
// whose value is sha256(APP_PASSWORD) — knowing the cookie does not reveal the
// password. Every page and API route re-verifies the cookie server-side.
//
// NOTE: this module uses node:crypto and next/headers, so it runs only in the
// Node.js runtime (pages + route handlers). proxy.ts (Edge runtime) does a
// lighter cookie-presence check instead — see proxy.ts.

import crypto from 'node:crypto';
import { cookies } from 'next/headers';

export const AUTH_COOKIE = 'pt_auth';

/** The expected cookie value for the configured password. */
export function expectedToken(): string {
  const pw = process.env.APP_PASSWORD ?? '';
  return crypto.createHash('sha256').update(pw).digest('hex');
}

/** Constant-time check of a submitted password against APP_PASSWORD. */
export function checkPassword(input: string): boolean {
  const pw = process.env.APP_PASSWORD ?? '';
  if (!pw) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(pw);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** True when the current request carries a valid auth cookie. */
export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE)?.value;
  return !!token && token === expectedToken();
}
