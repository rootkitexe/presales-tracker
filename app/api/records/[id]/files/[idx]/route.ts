import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';

type Ctx = { params: Promise<{ id: string; idx: string }> };

function parseIdx(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

// GET /api/records/:id/files/:idx — one JD file, including its bytes.
export async function GET(_request: Request, ctx: Ctx) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id, idx: rawIdx } = await ctx.params;
    const idx = parseIdx(rawIdx);
    if (idx === null) return NextResponse.json({ error: 'Bad file index.' }, { status: 400 });
    const { data, error } = await getSupabase().rpc('get_jd_file', { p_id: id, p_idx: idx });
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'File not found.' }, { status: 404 });
    return NextResponse.json({ file: data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// DELETE /api/records/:id/files/:idx?name=<file name> — remove one JD file.
// The name must match the file at that index (guards against stale indexes).
export async function DELETE(request: Request, ctx: Ctx) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id, idx: rawIdx } = await ctx.params;
    const idx = parseIdx(rawIdx);
    const name = new URL(request.url).searchParams.get('name') ?? '';
    if (idx === null || !name) {
      return NextResponse.json({ error: 'Bad file index or name.' }, { status: 400 });
    }
    const { data, error } = await getSupabase().rpc('remove_jd_file', {
      p_id: id,
      p_idx: idx,
      p_name: name,
    });
    if (error) throw error;
    if (!data) {
      return NextResponse.json(
        { error: 'File not found — the record may have changed. Refresh and try again.' },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
