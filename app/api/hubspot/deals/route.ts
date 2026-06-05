import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';

// HubSpot Deal properties we ask for. Pipeline / stage / owner are returned as
// HubSpot internal IDs — translating them to human-readable labels needs scopes
// (`crm.schemas.deals.read`, `crm.objects.owners.read`) we don't yet have, so
// the client renders them as raw IDs for now.
const PROPERTIES = [
  'dealname',
  'amount',
  'dealstage',
  'pipeline',
  'closedate',
  'createdate',
  'hs_lastmodifieddate',
  'hubspot_owner_id',
];

type SearchBody = {
  properties: string[];
  sorts: { propertyName: string; direction: 'ASCENDING' | 'DESCENDING' }[];
  limit: number;
  after?: string;
  filterGroups?: { filters: { propertyName: string; operator: string; value: string }[] }[];
};

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = process.env.HUBSPOT_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: 'HUBSPOT_TOKEN is not configured on the server.' },
      { status: 500 },
    );
  }

  let body: { q?: string; after?: string; limit?: number } = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine — fall through to defaults
  }

  const q = (body.q ?? '').trim();
  const limit = Math.min(Math.max(body.limit ?? 25, 1), 100);

  const searchBody: SearchBody = {
    properties: PROPERTIES,
    sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'DESCENDING' }],
    limit,
  };
  if (body.after) searchBody.after = body.after;
  if (q) {
    searchBody.filterGroups = [
      { filters: [{ propertyName: 'dealname', operator: 'CONTAINS_TOKEN', value: q }] },
    ];
  }

  try {
    const res = await fetch('https://api.hubapi.com/crm/v3/objects/deals/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(searchBody),
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.message ?? `HubSpot error (${res.status})` },
        { status: res.status },
      );
    }
    return NextResponse.json({
      deals: data.results ?? [],
      paging: data.paging ?? null,
      total: typeof data.total === 'number' ? data.total : null,
      portalId: process.env.HUBSPOT_PORTAL_ID ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
