import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
import { LIST_VIEW, sanitizeNew } from '@/lib/records';
import type { RecordInput } from '@/lib/types';

// GET /api/records — list all records, newest first. JD file bytes are omitted
// (names/sizes only); fetch a file via /api/records/:id/files/:idx.
export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from(LIST_VIEW)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ records: data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST /api/records — create records. Returns only the new ids.
//   { ...record }            → create one
//   { records: [...] }       → create many
//   { records: [...], replace: true } → delete everything, then create many
export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const replace = body?.replace === true;
    const incoming = Array.isArray(body?.records) ? body.records : [body];
    const rows = incoming.map(sanitizeNew).filter((r: RecordInput) => r.person && r.customer);
    if (!rows.length) {
      return NextResponse.json(
        { error: 'No valid records (person and customer are required).' },
        { status: 400 },
      );
    }
    const supabase = getSupabase();
    if (replace) {
      const { error: delErr } = await supabase.from('records').delete().not('id', 'is', null);
      if (delErr) throw delErr;
    }
    const { data, error } = await supabase.from('records').insert(rows).select('id');
    if (error) throw error;
    return NextResponse.json({ records: data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
