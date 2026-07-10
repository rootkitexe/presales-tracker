// Tool executors for the AI chat on the Dashboard.
// Read-only. All data is sanitized before being returned to the LLM:
//   - Tracker: JD file bytes stripped (only names kept).
//   - HubSpot: deal `amount` + contact PII omitted.

import { createClient } from '@supabase/supabase-js';
import { getOwnerMap, getStageMap } from './hubspot';

const supabase = () =>
  createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/* ------------------------------------------------------------------ */
/* Tracker search                                                     */
/* ------------------------------------------------------------------ */

interface SanitizedRecord {
  id: string;
  date: string;
  person: string;
  customer: string;
  status: string;
  tara: string;
  account: string;
  notes: string;
  assessments: { name: string; qb: string }[];
  jd_file_names: string[];
  jd_file_count: number;
}

function sanitizeRecord(r: {
  id: string;
  date: string;
  person: string;
  customer: string;
  status: string;
  tara: string;
  account: string;
  notes: string;
  assessments?: unknown;
  jd_files?: unknown;
}): SanitizedRecord {
  const assessments = Array.isArray(r.assessments)
    ? (r.assessments as { name?: string; qb?: string }[]).map((a) => ({
        name: a.name ?? '',
        qb: a.qb ?? '',
      }))
    : [];
  const jdFiles = Array.isArray(r.jd_files)
    ? (r.jd_files as { name?: string }[]).map((f) => f.name ?? '')
    : [];
  return {
    id: r.id,
    date: r.date,
    person: r.person,
    customer: r.customer,
    status: r.status,
    tara: r.tara,
    account: r.account,
    notes: (r.notes ?? '').slice(0, 600),
    assessments,
    jd_file_names: jdFiles,
    jd_file_count: jdFiles.length,
  };
}

function scoreRecord(r: SanitizedRecord, q: string): number {
  const ql = q.toLowerCase();
  let score = 0;
  const bump = (field: string, weight: number) => {
    if (field.toLowerCase().includes(ql)) score += weight;
  };
  bump(r.customer, 10);
  bump(r.person, 6);
  bump(r.status, 3);
  bump(r.tara, 2);
  bump(r.notes, 2);
  bump(r.account, 2);
  for (const a of r.assessments) {
    bump(a.name, 4);
    bump(a.qb, 2);
  }
  for (const n of r.jd_file_names) bump(n, 1);
  return score;
}

export async function searchTracker(query: string, limit = 15): Promise<SanitizedRecord[]> {
  const { data, error } = await supabase()
    .from('records')
    .select(
      'id,date,person,customer,status,tara,account,notes,assessments,jd_files',
    );
  if (error) throw error;
  const rows = (data ?? []).map(sanitizeRecord);
  if (!query.trim()) {
    return rows
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, limit);
  }
  return rows
    .map((r) => ({ r, s: scoreRecord(r, query) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.r);
}

/* ------------------------------------------------------------------ */
/* HubSpot search                                                     */
/* ------------------------------------------------------------------ */

interface SanitizedDeal {
  id: string;
  name: string | null;
  stage: string | null;
  pipeline: string | null;
  owner: string | null;
  target_close: string | null;
  days_open: number | null;
  days_since_activity: number | null;
}

interface SanitizedCompany {
  id: string;
  name: string | null;
  industry: string | null;
  country: string | null;
  city: string | null;
  lifecycle_stage: string | null;
  owner: string | null;
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

interface HubspotSearchBody {
  properties: string[];
  sorts: { propertyName: string; direction: 'ASCENDING' | 'DESCENDING' }[];
  limit: number;
  filterGroups?: { filters: { propertyName: string; operator: string; value: string }[] }[];
}

async function hubspotSearch<T>(
  endpoint: string,
  body: HubspotSearchBody,
  token: string,
): Promise<{ results: T[] } | { results: [] }> {
  const res = await fetch(`https://api.hubapi.com/crm/v3/objects/${endpoint}/search`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { results: [] };
  return res.json();
}

interface HubspotDealRaw {
  id: string;
  properties: Record<string, string | null | undefined>;
}

interface HubspotCompanyRaw {
  id: string;
  properties: Record<string, string | null | undefined>;
}

export async function searchHubspot(
  query: string,
  limit = 8,
): Promise<{ deals: SanitizedDeal[]; companies: SanitizedCompany[]; note?: string }> {
  const token = process.env.HUBSPOT_TOKEN;
  if (!token) {
    return { deals: [], companies: [], note: 'HubSpot not configured' };
  }
  const q = query.trim();
  if (!q) return { deals: [], companies: [] };

  const [ownerMap, stageMap] = await Promise.all([
    getOwnerMap(token).catch(() => new Map<string, string>()),
    getStageMap(token).catch(
      () => new Map<string, { stageLabel: string; pipelineLabel: string }>(),
    ),
  ]);

  const dealBody: HubspotSearchBody = {
    properties: [
      'dealname',
      'dealstage',
      'pipeline',
      'closedate',
      'createdate',
      'hs_lastmodifieddate',
      'hubspot_owner_id',
    ],
    sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'DESCENDING' }],
    limit,
    filterGroups: [
      { filters: [{ propertyName: 'dealname', operator: 'CONTAINS_TOKEN', value: q }] },
    ],
  };
  const companyBody: HubspotSearchBody = {
    properties: [
      'name',
      'industry',
      'country',
      'city',
      'lifecyclestage',
      'hubspot_owner_id',
    ],
    sorts: [{ propertyName: 'name', direction: 'ASCENDING' }],
    limit,
    filterGroups: [
      { filters: [{ propertyName: 'name', operator: 'CONTAINS_TOKEN', value: q }] },
    ],
  };

  const [dealsRes, companiesRes] = await Promise.all([
    hubspotSearch<HubspotDealRaw>('deals', dealBody, token),
    hubspotSearch<HubspotCompanyRaw>('companies', companyBody, token),
  ]);

  const deals: SanitizedDeal[] = (dealsRes.results ?? []).map((d) => {
    const p = d.properties;
    const stageId = p.dealstage ?? '';
    const stage = stageMap.get(String(stageId));
    return {
      id: d.id,
      name: p.dealname ?? null,
      stage: stage?.stageLabel ?? p.dealstage ?? null,
      pipeline: stage?.pipelineLabel ?? p.pipeline ?? null,
      owner: p.hubspot_owner_id ? ownerMap.get(String(p.hubspot_owner_id)) ?? null : null,
      target_close: p.closedate ?? null,
      days_open: daysSince(p.createdate),
      days_since_activity: daysSince(p.hs_lastmodifieddate),
    };
  });

  const companies: SanitizedCompany[] = (companiesRes.results ?? []).map((c) => {
    const p = c.properties;
    return {
      id: c.id,
      name: p.name ?? null,
      industry: p.industry ?? null,
      country: p.country ?? null,
      city: p.city ?? null,
      lifecycle_stage: p.lifecyclestage ?? null,
      owner: p.hubspot_owner_id ? ownerMap.get(String(p.hubspot_owner_id)) ?? null : null,
    };
  });

  return { deals, companies };
}
