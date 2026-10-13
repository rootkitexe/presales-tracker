import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getSql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/recent-requests/count — number of pending emails (no row data).
export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const [row] = await getSql()`
      select count(*)::int as count from recent_requests where status = 'pending'`;
    return NextResponse.json({ ok: true, count: row.count });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
