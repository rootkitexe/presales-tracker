import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getSql, isUuid, json } from '@/lib/db';
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
    if (!isUuid(id)) return NextResponse.json({ error: 'Record not found.' }, { status: 404 });
    const p = sanitizeFields(await request.json());
    if (!p.person || !p.customer) {
      return NextResponse.json(
        { error: 'Person and customer are required.' },
        { status: 400 },
      );
    }
    const sql = getSql();
    const [record] = await sql`
      update records set
        person = ${p.person}, customer = ${p.customer}, status = ${p.status},
        account = ${p.account}, tara = ${p.tara}, notes = ${p.notes}, date = ${p.date},
        assessments = ${json(p.assessments)}
      where id = ${id}
      returning id`;
    if (!record) return NextResponse.json({ error: 'Record not found.' }, { status: 404 });
    return NextResponse.json({ record });
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
    if (!isUuid(id)) return NextResponse.json({ error: 'Record not found.' }, { status: 404 });
    await getSql()`delete from records where id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
