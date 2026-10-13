import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET /api/recent-requests — pending emails, newest first. Attachment bytes are
// omitted (see the recent_requests_list view); fetch them via
// /api/recent-requests/:id/attachments.
export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { data, error } = await getSupabase()
      .from('recent_requests_list')
      .select('*')
      .eq('status', 'pending')
      .order('received_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ ok: true, items: data ?? [] });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
