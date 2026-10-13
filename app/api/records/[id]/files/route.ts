import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getSql, isUuid, json } from '@/lib/db';
import { sanitizeFiles } from '@/lib/records';

type Ctx = { params: Promise<{ id: string }> };

// POST /api/records/:id/files — append JD files. Body: { files: JdFile[] }.
export async function POST(request: Request, ctx: Ctx) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await ctx.params;
    if (!isUuid(id)) return NextResponse.json({ error: 'Record not found.' }, { status: 404 });
    const body = await request.json();
    const files = sanitizeFiles(body?.files);
    if (!files.length) {
      return NextResponse.json({ error: 'No files to add.' }, { status: 400 });
    }
    const sql = getSql();
    const [row] = await sql`
      update records set jd_files = jd_files || ${json(files)}
      where id = ${id}
      returning id`;
    if (!row) return NextResponse.json({ error: 'Record not found.' }, { status: 404 });
    return NextResponse.json({ ok: true, added: files.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
