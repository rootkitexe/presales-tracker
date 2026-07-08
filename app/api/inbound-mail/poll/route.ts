import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getValidAccessToken, getAccount } from '@/lib/ms-oauth';
import { AM_EMAILS_LOWER } from '@/lib/am-list';
import { looksLikeRequest } from '@/lib/mail-filter';

export const dynamic = 'force-dynamic';

const supabase = () =>
  createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

interface GraphMessage {
  id: string;
  subject: string | null;
  bodyPreview: string | null;
  receivedDateTime: string;
  hasAttachments: boolean;
  from: {
    emailAddress: {
      name: string;
      address: string;
    };
  } | null;
}

interface GraphAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  contentBytes?: string;
  '@odata.type': string;
}

async function fetchAttachments(accessToken: string, messageId: string) {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages/${messageId}/attachments`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) return [];
  const data = await res.json();
  const list: GraphAttachment[] = data.value ?? [];
  return list
    .filter((a) => a['@odata.type'] === '#microsoft.graph.fileAttachment')
    .map((a) => ({
      name: a.name,
      contentType: a.contentType,
      size: a.size,
      dataUrl: a.contentBytes ? `data:${a.contentType};base64,${a.contentBytes}` : undefined,
    }));
}

async function runPoll() {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return { ok: false, error: 'Outlook not connected', status: 400 as const };
  }

  const account = await getAccount();
  // First poll: look back 30 days. Subsequent polls: since last poll.
  const since =
    account?.last_polled_at ?? new Date(Date.now() - 30 * 86_400_000).toISOString();

  const fromFilter = AM_EMAILS_LOWER.map(
    (e) => `from/emailAddress/address eq '${e}'`,
  ).join(' or ');
  const filter = `receivedDateTime ge ${since} and (${fromFilter})`;

  const url = new URL('https://graph.microsoft.com/v1.0/me/messages');
  url.searchParams.set(
    '$select',
    'id,from,subject,bodyPreview,receivedDateTime,hasAttachments',
  );
  url.searchParams.set('$filter', filter);
  url.searchParams.set('$orderby', 'receivedDateTime desc');
  url.searchParams.set('$top', '50');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    return { ok: false, error: `graph messages failed: ${res.status} ${err}`, status: 500 as const };
  }

  const data = await res.json();
  const messages: GraphMessage[] = data.value ?? [];
  const db = supabase();

  let newCount = 0;
  let filteredOut = 0;
  const errors: string[] = [];

  for (const msg of messages) {
    try {
      if (!looksLikeRequest(msg.subject, msg.bodyPreview)) {
        filteredOut++;
        continue;
      }

      const { data: existing } = await db
        .from('recent_requests')
        .select('id')
        .eq('ms_message_id', msg.id)
        .maybeSingle();
      if (existing) continue;

      let attachments: unknown[] = [];
      if (msg.hasAttachments) {
        attachments = await fetchAttachments(accessToken, msg.id);
      }

      const { error: insertError } = await db.from('recent_requests').insert({
        ms_message_id: msg.id,
        from_name: msg.from?.emailAddress?.name ?? null,
        from_email: msg.from?.emailAddress?.address ?? '',
        subject: msg.subject ?? '',
        body_preview: msg.bodyPreview ?? '',
        received_at: msg.receivedDateTime,
        attachments,
        has_attachments: msg.hasAttachments,
      });
      if (insertError) throw insertError;
      newCount++;
    } catch (e) {
      errors.push(`msg ${msg.id}: ${(e as Error).message}`);
    }
  }

  await db
    .from('ms_account')
    .update({
      last_polled_at: new Date().toISOString(),
      last_poll_error: errors.length ? errors.join('; ').slice(0, 500) : null,
    })
    .eq('id', 'default');

  return {
    ok: true,
    newCount,
    totalChecked: messages.length,
    filteredOut,
    errors,
    status: 200 as const,
  };
}

export async function POST() {
  const result = await runPoll();
  const { status, ...body } = result;
  return NextResponse.json(body, { status });
}

export const GET = POST;
