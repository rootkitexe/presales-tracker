import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getValidAccessToken } from '@/lib/ms-oauth';

export const dynamic = 'force-dynamic';

const supabase = () =>
  createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

interface GraphRecipient {
  emailAddress?: { name?: string; address?: string };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const { data: row, error: rowError } = await supabase()
      .from('recent_requests')
      .select('ms_message_id')
      .eq('id', id)
      .maybeSingle();
    if (rowError) throw rowError;
    if (!row) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });

    const token = await getValidAccessToken();
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Outlook not connected' }, { status: 400 });
    }

    const url =
      `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(row.ms_message_id)}` +
      `?$select=body,subject,from,toRecipients,ccRecipients,receivedDateTime`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`graph fetch failed: ${res.status} ${err.slice(0, 200)}`);
    }
    const msg = await res.json();

    return NextResponse.json({
      ok: true,
      subject: msg.subject ?? '',
      body: {
        contentType: msg.body?.contentType ?? 'text',
        content: msg.body?.content ?? '',
      },
      from: msg.from?.emailAddress ?? null,
      to: (msg.toRecipients ?? []).map((r: GraphRecipient) => r.emailAddress).filter(Boolean),
      cc: (msg.ccRecipients ?? []).map((r: GraphRecipient) => r.emailAddress).filter(Boolean),
      receivedAt: msg.receivedDateTime ?? null,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
