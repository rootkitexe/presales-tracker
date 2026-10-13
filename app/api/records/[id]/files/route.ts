import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
import { sanitizeFiles } from '@/lib/records';

type Ctx = { params: Promise<{ id: string }> };

// POST /api/records/:id/files — append JD files. Body: { files: JdFile[] }.
export async function POST(request: Request, ctx: Ctx) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await ctx.params;
    const body = await request.json();
    const files = sanitizeFiles(body?.files);
    if (!files.length) {
      return NextResponse.json({ error: 'No files to add.' }, { status: 400 });
    }
    const { error } = await getSupabase().rpc('append_jd_files', { p_id: id, p_files: files });
    if (error) throw error;
    return NextResponse.json({ ok: true, added: files.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
