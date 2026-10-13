import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
import { sanitizeFields } from '@/lib/records';

type Ctx = { params: Promise<{ id: string }> };

// PUT /api/records/:id — update a record's fields. JD files are not touched
// here; they change via /api/records/:id/files so an edit never re-sends them.
export async function PUT(request: Request, ctx: Ctx) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await ctx.params;
    const patch = sanitizeFields(await request.json());
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
      .select('id')
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
