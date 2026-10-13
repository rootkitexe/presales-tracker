import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getSql, isUuid } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/recent-requests/:id/attachments — one email's attachments, with bytes.
// Fetched only when the user opens an attachment or adds the email to the tracker.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!isUuid(id)) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });
  try {
    const [row] = await getSql()`select attachments from recent_requests where id = ${id}`;
    if (!row) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });
    return NextResponse.json({ ok: true, attachments: row.attachments ?? [] });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
