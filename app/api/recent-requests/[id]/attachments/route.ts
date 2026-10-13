import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET /api/recent-requests/:id/attachments — one email's attachments, with bytes.
// Fetched only when the user opens an attachment or adds the email to the tracker.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;
  try {
    const { data, error } = await getSupabase()
      .from('recent_requests')
      .select('attachments')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });
    return NextResponse.json({ ok: true, attachments: data.attachments ?? [] });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
