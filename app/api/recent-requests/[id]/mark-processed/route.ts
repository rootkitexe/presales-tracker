import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getSql, isUuid } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!isUuid(id)) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });
  try {
    const body = await req.json().catch(() => ({}));
    const raw = String(body?.processedRecordId ?? '');
    const processedRecordId = isUuid(raw) ? raw : null;
    await getSql()`
      update recent_requests
      set status = 'processed', processed_at = now(), processed_record_id = ${processedRecordId}
      where id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
