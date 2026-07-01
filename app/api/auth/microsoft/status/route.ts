import { NextResponse } from 'next/server';
import { getAccount } from '@/lib/ms-oauth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const acct = await getAccount();
    if (!acct) return NextResponse.json({ connected: false });
    return NextResponse.json({
      connected: true,
      email: acct.ms_email,
      name: acct.ms_name,
      connectedAt: acct.connected_at,
      lastPolledAt: acct.last_polled_at,
    });
  } catch (e) {
    return NextResponse.json({ connected: false, error: (e as Error).message }, { status: 500 });
  }
}
