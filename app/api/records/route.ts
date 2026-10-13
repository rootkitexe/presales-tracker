import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getSql, json } from '@/lib/db';
import { sanitizeNew } from '@/lib/records';
import type { RecordInput } from '@/lib/types';

// GET /api/records — list all records, newest first. JD file bytes are omitted
// (the records_list view keeps names/sizes only); fetch a file via
// /api/records/:id/files/:idx.
export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const sql = getSql();
    const records = await sql`select * from records_list order by created_at desc`;
    return NextResponse.json({ records });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST /api/records — create records. Returns only the new ids.
//   { ...record }            → create one
//   { records: [...] }       → create many
//   { records: [...], replace: true } → delete everything, then create many
// Runs in one transaction, so a failed insert leaves the old data intact.
export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const replace = body?.replace === true;
    const incoming = Array.isArray(body?.records) ? body.records : [body];
    const rows: RecordInput[] = incoming
      .map(sanitizeNew)
      .filter((r: RecordInput) => r.person && r.customer);
    if (!rows.length) {
      return NextResponse.json(
        { error: 'No valid records (person and customer are required).' },
        { status: 400 },
      );
    }
    const sql = getSql();
    const records = await sql.begin(async (tx) => {
      if (replace) await tx`delete from records`;
      const inserted: { id: string }[] = [];
      for (const r of rows) {
        const [row] = await tx<{ id: string }[]>`
          insert into records
            (person, customer, status, account, tara, notes, date, assessments, jd_files)
          values
            (${r.person}, ${r.customer}, ${r.status}, ${r.account}, ${r.tara}, ${r.notes},
             ${r.date}, ${json(r.assessments)}, ${json(r.jd_files)})
          returning id`;
        inserted.push(row);
      }
      return inserted;
    });
    return NextResponse.json({ records });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
