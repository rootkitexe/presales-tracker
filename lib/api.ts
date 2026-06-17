// Client-side helpers for talking to the /api/records endpoints.
// All calls go through the password-gated Next.js API routes.

import type { PresalesRecord, RecordInput } from './types';

async function jsonOrThrow(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

export async function fetchRecords(): Promise<PresalesRecord[]> {
  const res = await fetch('/api/records', { cache: 'no-store' });
  const data = await jsonOrThrow(res);
  return (data.records ?? []) as PresalesRecord[];
}

export async function createRecords(
  records: RecordInput | RecordInput[],
): Promise<PresalesRecord[]> {
  const body = Array.isArray(records) ? { records } : records;
  const res = await fetch('/api/records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await jsonOrThrow(res);
  return (data.records ?? []) as PresalesRecord[];
}

/** Deletes every existing record, then inserts the given ones. */
export async function replaceAllRecords(records: RecordInput[]): Promise<PresalesRecord[]> {
  const res = await fetch('/api/records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ records, replace: true }),
  });
  const data = await jsonOrThrow(res);
  return (data.records ?? []) as PresalesRecord[];
}

export async function updateRecord(id: string, record: RecordInput): Promise<PresalesRecord> {
  const res = await fetch(`/api/records/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  });
  const data = await jsonOrThrow(res);
  return data.record as PresalesRecord;
}

export async function deleteRecord(id: string): Promise<void> {
  const res = await fetch(`/api/records/${id}`, { method: 'DELETE' });
  await jsonOrThrow(res);
}

export async function logout(): Promise<void> {
  await fetch('/api/logout', { method: 'POST' });
}

type HubspotResolvedDeal = {
  ownerName: string | null;
  stageLabel: string | null;
  pipelineLabel: string | null;
};

export type HubspotDeal = {
  id: string;
  properties: {
    dealname?: string;
    amount?: string;
    dealstage?: string;
    pipeline?: string;
    closedate?: string;
    createdate?: string;
    hs_lastmodifieddate?: string;
    hubspot_owner_id?: string;
  };
  createdAt?: string;
  updatedAt?: string;
  resolved?: HubspotResolvedDeal;
};

export type HubspotDealsResponse = {
  deals: HubspotDeal[];
  paging: { next?: { after: string } } | null;
  total: number | null;
  portalId: string | null;
};

export async function fetchHubspotDeals(
  opts: { q?: string; after?: string; limit?: number } = {},
): Promise<HubspotDealsResponse> {
  const res = await fetch('/api/hubspot/deals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  const data = await jsonOrThrow(res);
  return {
    deals: data.deals ?? [],
    paging: data.paging ?? null,
    total: data.total ?? null,
    portalId: data.portalId ?? null,
  };
}

export type HubspotCompany = {
  id: string;
  properties: {
    name?: string;
    domain?: string;
    website?: string;
    industry?: string;
    lifecyclestage?: string;
    hubspot_owner_id?: string;
    city?: string;
    country?: string;
    numberofemployees?: string;
  };
  resolved?: { ownerName: string | null };
};

export type HubspotCompaniesResponse = {
  companies: HubspotCompany[];
  paging: { next?: { after: string } } | null;
  total: number | null;
  portalId: string | null;
};

export async function fetchHubspotCompanies(
  opts: { q?: string; after?: string; limit?: number } = {},
): Promise<HubspotCompaniesResponse> {
  const res = await fetch('/api/hubspot/companies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  const data = await jsonOrThrow(res);
  return {
    companies: data.companies ?? [],
    paging: data.paging ?? null,
    total: data.total ?? null,
    portalId: data.portalId ?? null,
  };
}

/** Strips server-managed fields, leaving a RecordInput suitable for create/update. */
export function toInput(r: PresalesRecord | RecordInput): RecordInput {
  return {
    person: r.person,
    customer: r.customer,
    status: r.status,
    account: r.account,
    tara: r.tara,
    notes: r.notes,
    date: r.date,
    assessments: r.assessments ?? [],
    jd_files: r.jd_files ?? [],
  };
}
