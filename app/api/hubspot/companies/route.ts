import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getOwnerMap } from '@/lib/hubspot';

const PROPERTIES = [
  'name',
  'domain',
  'website',
  'industry',
  'lifecyclestage',
  'hubspot_owner_id',
  'city',
  'country',
  'numberofemployees',
];

type SearchBody = {
  properties: string[];
  sorts: { propertyName: string; direction: 'ASCENDING' | 'DESCENDING' }[];
  limit: number;
  after?: string;
  filterGroups?: { filters: { propertyName: string; operator: string; value: string }[] }[];
};

type HubspotCompanyRaw = {
  id: string;
  properties: Record<string, string | null | undefined>;
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
    // empty body is fine
  }

  const q = (body.q ?? '').trim();
  const limit = Math.min(Math.max(body.limit ?? 25, 1), 100);

  const searchBody: SearchBody = {
    properties: PROPERTIES,
    sorts: [{ propertyName: q ? 'name' : 'hs_lastmodifieddate', direction: q ? 'ASCENDING' : 'DESCENDING' }],
    limit,
  };
  if (body.after) searchBody.after = body.after;
  if (q) {
    searchBody.filterGroups = [
      { filters: [{ propertyName: 'name', operator: 'CONTAINS_TOKEN', value: q }] },
    ];
  }

  try {
    const res = await fetch('https://api.hubapi.com/crm/v3/objects/companies/search', {
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

    let ownerMap = new Map<string, string>();
    try {
      ownerMap = await getOwnerMap(token);
    } catch {
      // ignore
    }

    const companies = ((data.results ?? []) as HubspotCompanyRaw[]).map((c) => {
      const ownerId = c.properties.hubspot_owner_id;
      return {
        ...c,
        resolved: {
          ownerName: ownerId ? ownerMap.get(String(ownerId)) ?? null : null,
        },
      };
    });

    return NextResponse.json({
      companies,
      paging: data.paging ?? null,
      total: typeof data.total === 'number' ? data.total : null,
      portalId: process.env.HUBSPOT_PORTAL_ID ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
