import { NextResponse } from 'next/server';
import { disconnect } from '@/lib/ms-oauth';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await disconnect();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
