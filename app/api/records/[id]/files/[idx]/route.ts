import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getSql, isUuid } from '@/lib/db';

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
    if (idx === null || !isUuid(id)) {
      return NextResponse.json({ error: 'File not found.' }, { status: 404 });
    }
    const [row] = await getSql()`
      select jd_files -> ${idx}::int as file from records where id = ${id}`;
    if (!row?.file) return NextResponse.json({ error: 'File not found.' }, { status: 404 });
    return NextResponse.json({ file: row.file });
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
    if (idx === null || !name || !isUuid(id)) {
      return NextResponse.json({ error: 'Bad file index or name.' }, { status: 400 });
    }
    const [row] = await getSql()`
      update records set jd_files = jd_files - ${idx}::int
      where id = ${id} and jd_files -> ${idx}::int ->> 'name' = ${name}
      returning id`;
    if (!row) {
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
