import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
import type { RecordInput } from '@/lib/types';

/** Normalises an untrusted payload into a clean RecordInput row. */
function sanitize(r: Record<string, unknown>): RecordInput {
  return {
    person: String(r.person ?? '').trim(),
    customer: String(r.customer ?? '').trim(),
    status: String(r.status ?? ''),
    account: String(r.account ?? '').trim(),
    tara: String(r.tara ?? ''),
    notes: String(r.notes ?? '').trim(),
    date: String(r.date ?? ''),
    assessments: Array.isArray(r.assessments) ? r.assessments : [],
    jd_files: Array.isArray(r.jd_files) ? r.jd_files : [],
  };
}

// GET /api/records — list all records, newest first.
export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('records')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ records: data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST /api/records — create records.
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
    const rows = incoming.map(sanitize).filter((r: RecordInput) => r.person && r.customer);
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
    const { data, error } = await supabase.from('records').insert(rows).select();
    if (error) throw error;
    return NextResponse.json({ records: data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
