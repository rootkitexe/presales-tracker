import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getSql, json } from '@/lib/db';
import { getValidAccessToken, getAccount } from '@/lib/ms-oauth';
import { AM_EMAILS_LOWER } from '@/lib/am-list';
import { looksLikeRequest } from '@/lib/mail-filter';

export const dynamic = 'force-dynamic';

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
  const since = new Date(
    account?.last_polled_at ?? Date.now() - 30 * 86_400_000,
  ).toISOString();

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
  const sql = getSql();

  let newCount = 0;
  let filteredOut = 0;
  const errors: string[] = [];

  for (const msg of messages) {
    try {
      if (!looksLikeRequest(msg.subject, msg.bodyPreview)) {
        filteredOut++;
        continue;
      }

      const [existing] = await sql`select id from recent_requests where ms_message_id = ${msg.id}`;
      if (existing) continue;

      let attachments: unknown[] = [];
      if (msg.hasAttachments) {
        attachments = await fetchAttachments(accessToken, msg.id);
      }

      await sql`
        insert into recent_requests
          (ms_message_id, from_name, from_email, subject, body_preview, received_at,
           attachments, has_attachments)
        values
          (${msg.id}, ${msg.from?.emailAddress?.name ?? null},
           ${msg.from?.emailAddress?.address ?? ''}, ${msg.subject ?? ''},
           ${msg.bodyPreview ?? ''}, ${msg.receivedDateTime},
           ${json(attachments)}, ${msg.hasAttachments})
        on conflict (ms_message_id) do nothing`;
      newCount++;
    } catch (e) {
      errors.push(`msg ${msg.id}: ${(e as Error).message}`);
    }
  }

  await sql`
    update ms_account set
      last_polled_at = now(),
      last_poll_error = ${errors.length ? errors.join('; ').slice(0, 500) : null}
    where id = 'default'`;

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
  if (!(await isAuthenticated())) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { status, ...body } = await runPoll();
    return NextResponse.json(body, { status });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

export const GET = POST;
