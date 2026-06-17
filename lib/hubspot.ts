// Server-side HubSpot lookup helpers.
//
// Owners and pipeline stages are tiny, slow-changing data sets that almost
// every Deals / Companies request needs to translate raw HubSpot IDs into
// human-readable labels. We cache both in module-scoped Maps with a 10-min
// TTL so repeated tab interactions don't re-hit HubSpot for the same data.

const TTL_MS = 10 * 60_000;

type OwnerCache = { fetchedAt: number; map: Map<string, string> };
type StageCache = {
  fetchedAt: number;
  map: Map<string, { stageLabel: string; pipelineLabel: string }>;
};

let ownerCache: OwnerCache | null = null;
let stageCache: StageCache | null = null;

type HubspotOwner = {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
};

type HubspotStage = { id: string; label: string };
type HubspotPipeline = { id: string; label: string; stages?: HubspotStage[] };

/** owner id (string) → "First Last" (falls back to email, then "#id"). */
export async function getOwnerMap(token: string): Promise<Map<string, string>> {
  if (ownerCache && Date.now() - ownerCache.fetchedAt < TTL_MS) {
    return ownerCache.map;
  }
  const map = new Map<string, string>();
  let after: string | undefined;
  // Walk all pages — owners lists are small (tens / low hundreds).
  do {
    const url = new URL('https://api.hubapi.com/crm/v3/owners');
    url.searchParams.set('limit', '100');
    if (after) url.searchParams.set('after', after);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) break;
    const data = (await res.json()) as {
      results?: HubspotOwner[];
      paging?: { next?: { after: string } };
    };
    for (const o of data.results ?? []) {
      const name =
        `${o.firstName ?? ''} ${o.lastName ?? ''}`.trim() || o.email || `#${o.id}`;
      map.set(String(o.id), name);
    }
    after = data.paging?.next?.after;
  } while (after);
  ownerCache = { fetchedAt: Date.now(), map };
  return map;
}

/** stage id (string) → { stageLabel, pipelineLabel } for the deals object. */
export async function getStageMap(
  token: string,
): Promise<Map<string, { stageLabel: string; pipelineLabel: string }>> {
  if (stageCache && Date.now() - stageCache.fetchedAt < TTL_MS) {
    return stageCache.map;
  }
  const map = new Map<string, { stageLabel: string; pipelineLabel: string }>();
  const res = await fetch('https://api.hubapi.com/crm/v3/pipelines/deals', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.ok) {
    const data = (await res.json()) as { results?: HubspotPipeline[] };
    for (const p of data.results ?? []) {
      for (const s of p.stages ?? []) {
        map.set(String(s.id), { stageLabel: s.label, pipelineLabel: p.label });
      }
    }
  }
  stageCache = { fetchedAt: Date.now(), map };
  return map;
}
