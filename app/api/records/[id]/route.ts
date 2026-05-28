import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
import type { RecordInput } from '@/lib/types';

type Ctx = { params: Promise<{ id: string }> };

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

// PUT /api/records/:id — replace a record.
export async function PUT(request: Request, ctx: Ctx) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await ctx.params;
    const patch = sanitize(await request.json());
    if (!patch.person || !patch.customer) {
      return NextResponse.json(
        { error: 'Person and customer are required.' },
        { status: 400 },
      );
    }
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('records')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ record: data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// DELETE /api/records/:id — remove a record.
export async function DELETE(_request: Request, ctx: Ctx) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await ctx.params;
    const supabase = getSupabase();
    const { error } = await supabase.from('records').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
