import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { authUrl } from '@/lib/ms-oauth';

export const dynamic = 'force-dynamic';

const STATE_COOKIE = 'ms_oauth_state';

export async function GET() {
  const state = crypto.randomBytes(24).toString('hex');
  const res = NextResponse.redirect(authUrl(state));
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return res;
}
