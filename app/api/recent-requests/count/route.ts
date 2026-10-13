import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET /api/recent-requests/count — number of pending emails (no row data).
export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { count, error } = await getSupabase()
      .from('recent_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    if (error) throw error;
    return NextResponse.json({ ok: true, count: count ?? 0 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
