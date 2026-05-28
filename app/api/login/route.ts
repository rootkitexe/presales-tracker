import { NextResponse } from 'next/server';
import { AUTH_COOKIE, checkPassword, expectedToken } from '@/lib/auth';

// POST /api/login — verify the shared password and set the auth cookie.
export async function POST(request: Request) {
  if (!process.env.APP_PASSWORD) {
    return NextResponse.json(
      { error: 'Server not configured: APP_PASSWORD is not set.' },
      { status: 500 },
    );
  }

  let password = '';
  try {
    const body = await request.json();
    password = typeof body?.password === 'string' ? body.password : '';
  } catch {
    /* empty / invalid body — treated as wrong password below */
  }

  if (!checkPassword(password)) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, expectedToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
