import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { disconnect } from '@/lib/ms-oauth';

export const dynamic = 'force-dynamic';

export async function POST() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await disconnect();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
