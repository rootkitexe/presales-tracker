import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const supabase = getSupabase;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;
  try {
    const body = await req.json().catch(() => ({}));
    const processedRecordId = body?.processedRecordId ?? null;
    const { error } = await supabase()
      .from('recent_requests')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString(),
        processed_record_id: processedRecordId,
      })
      .eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
