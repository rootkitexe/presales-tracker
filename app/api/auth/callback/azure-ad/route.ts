import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeCodeForTokens, saveAccount } from '@/lib/ms-oauth';

export const dynamic = 'force-dynamic';

const STATE_COOKIE = 'ms_oauth_state';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDesc = url.searchParams.get('error_description');

  const home = new URL('/', req.url);

  if (error) {
    home.searchParams.set('ms_error', errorDesc ?? error);
    return NextResponse.redirect(home);
  }
  if (!code || !state) {
    home.searchParams.set('ms_error', 'missing code or state');
    return NextResponse.redirect(home);
  }

  const jar = await cookies();
  const expected = jar.get(STATE_COOKIE)?.value;
  if (!expected || expected !== state) {
    home.searchParams.set('ms_error', 'state mismatch');
    return NextResponse.redirect(home);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const account = await saveAccount(tokens);
    home.searchParams.set('ms_connected', account.ms_email ?? '1');
  } catch (e) {
    home.searchParams.set('ms_error', (e as Error).message);
  }

  const res = NextResponse.redirect(home);
  res.cookies.delete(STATE_COOKIE);
  return res;
}
