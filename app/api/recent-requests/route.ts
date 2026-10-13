import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getSql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/recent-requests — pending emails, newest first. Attachment bytes are
// omitted (see the recent_requests_list view); fetch them via
// /api/recent-requests/:id/attachments.
export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const items = await getSql()`
      select * from recent_requests_list
      where status = 'pending'
      order by received_at desc`;
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
