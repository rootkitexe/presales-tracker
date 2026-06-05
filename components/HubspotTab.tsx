'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchHubspotDeals, type HubspotDeal } from '@/lib/api';

function fmtAmount(raw?: string) {
  if (!raw) return '—';
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function fmtDate(raw?: string) {
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function dealUrl(portalId: string | null, id: string) {
  if (!portalId) return null;
  return `https://app.hubspot.com/contacts/${portalId}/record/0-3/${id}`;
}

export default function HubspotTab() {
  const [deals, setDeals] = useState<HubspotDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [nextAfter, setNextAfter] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [portalId, setPortalId] = useState<string | null>(null);

  const load = useCallback(async (q: string, after?: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchHubspotDeals({ q, after });
      setDeals((prev) => (after ? [...prev, ...data.deals] : data.deals));
      setNextAfter(data.paging?.next?.after ?? null);
      setTotal(data.total);
      setPortalId(data.portalId);
    } catch (e) {
      setError((e as Error).message);
      if (!after) setDeals([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load('');
  }, [load]);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    setActiveQuery(q);
    load(q);
  }

  function clearSearch() {
    setQuery('');
    setActiveQuery('');
    load('');
  }

  return (
    <div>
      <div
        style={{
          background: 'linear-gradient(135deg, #fff7ed 0%, #fffaf3 100%)',
          border: '1px solid #fed7aa',
          borderRadius: 12,
          padding: '14px 18px',
          marginBottom: 18,
          fontSize: 13,
          lineHeight: 1.6,
          color: '#7c2d12',
        }}
      >
        <strong style={{ fontWeight: 700 }}>Limited preview.</strong> Only HubSpot
        <strong> Deals</strong> are readable with the current Private App scopes.
        Stage and Owner show as internal IDs until the admin grants the additional
        scopes — see the team note below the table.
      </div>

      <form
        onSubmit={onSearch}
        style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}
      >
        <input
          className="fi"
          style={{ flex: 1, maxWidth: 380 }}
          placeholder="Search deal name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn btn-p" type="submit" disabled={loading}>
          Search
        </button>
        {activeQuery && (
          <button className="btn" type="button" onClick={clearSearch} disabled={loading}>
            Clear
          </button>
        )}
        {total !== null && (
          <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--muted)' }}>
            {total.toLocaleString()} match{total === 1 ? '' : 'es'}
            {activeQuery && <> for <em>“{activeQuery}”</em></>}
          </span>
        )}
      </form>

      {error && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            borderRadius: 10,
            padding: '12px 16px',
            marginBottom: 14,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 280 }}>Deal</th>
              <th style={{ width: 120 }}>Amount</th>
              <th style={{ width: 140 }}>Stage</th>
              <th style={{ width: 120 }}>Owner</th>
              <th style={{ width: 140 }}>Close date</th>
              <th style={{ width: 150 }}>Last modified</th>
              <th style={{ width: 100 }}>Open</th>
            </tr>
          </thead>
          <tbody>
            {loading && deals.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 48 }}>
                  <span className="spinner" />
                  <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--muted)' }}>
                    Loading deals from HubSpot…
                  </div>
                </td>
              </tr>
            )}
            {!loading && deals.length === 0 && !error && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>
                  No deals found{activeQuery ? <> for “{activeQuery}”</> : ''}.
                </td>
              </tr>
            )}
            {deals.map((d) => {
              const url = dealUrl(portalId, d.id);
              return (
                <tr key={d.id}>
                  <td>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>
                      {d.properties.dealname || '—'}
                    </span>
                  </td>
                  <td>{fmtAmount(d.properties.amount)}</td>
                  <td>
                    <span
                      title={`HubSpot stage ID ${d.properties.dealstage ?? '—'}`}
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: '#f1f5f9',
                        color: '#475569',
                        fontSize: 11.5,
                        fontFamily: 'var(--font-mono, ui-monospace, monospace)',
                      }}
                    >
                      #{d.properties.dealstage ?? '—'}
                    </span>
                  </td>
                  <td>
                    <span
                      title={`HubSpot owner ID ${d.properties.hubspot_owner_id ?? '—'}`}
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: '#f1f5f9',
                        color: '#475569',
                        fontSize: 11.5,
                        fontFamily: 'var(--font-mono, ui-monospace, monospace)',
                      }}
                    >
                      #{d.properties.hubspot_owner_id ?? '—'}
                    </span>
                  </td>
                  <td>{fmtDate(d.properties.closedate)}</td>
                  <td>{fmtDate(d.properties.hs_lastmodifieddate)}</td>
                  <td>
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 12.5 }}
                      >
                        Open ↗
                      </a>
                    ) : (
                      <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {nextAfter && (
        <div style={{ textAlign: 'center', padding: 18 }}>
          <button
            className="btn"
            onClick={() => load(activeQuery, nextAfter)}
            disabled={loading}
          >
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}

      <details
        style={{
          marginTop: 24,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '14px 18px',
          fontSize: 13,
          lineHeight: 1.7,
        }}
      >
        <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--text)' }}>
          What we have today vs. what we need
        </summary>
        <div style={{ marginTop: 12, color: 'var(--text)' }}>
          <p style={{ marginBottom: 10 }}>
            The Private App token works. Only one scope is currently granted, which
            limits what this tab can show.
          </p>
          <p style={{ margin: '14px 0 6px', fontWeight: 600 }}>Granted now</p>
          <ul style={{ marginLeft: 18, marginBottom: 12 }}>
            <li>
              <code>crm.objects.deals.read</code> — list / search deals, read amount,
              close date, last-modified, raw stage / pipeline / owner IDs.
            </li>
          </ul>
          <p style={{ margin: '14px 0 6px', fontWeight: 600 }}>
            Needed to make this tab fully useful
          </p>
          <ul style={{ marginLeft: 18, marginBottom: 12 }}>
            <li>
              <code>crm.objects.companies.read</code> — match a tracker customer
              name to its HubSpot company.
            </li>
            <li>
              <code>crm.objects.owners.read</code> — translate owner IDs into AM
              names (so the table shows “Priya” instead of <code>#30314130</code>).
            </li>
            <li>
              <code>crm.schemas.deals.read</code> — translate stage / pipeline IDs
              into labels (“Demo Scheduled”, “Closed Won”, etc.).
            </li>
            <li>
              <code>crm.objects.contacts.read</code> — optional; lets us show the
              stakeholders on a company.
            </li>
          </ul>
          <p style={{ margin: '14px 0 6px', fontWeight: 600 }}>
            How the admin grants them
          </p>
          <ol style={{ marginLeft: 18 }}>
            <li>HubSpot → Settings → Integrations → Private Apps → open the app.</li>
            <li>Scopes tab → tick the four scopes above (all read-only).</li>
            <li>
              Save. The existing token keeps working — no need to regenerate or
              redistribute.
            </li>
          </ol>
        </div>
      </details>
    </div>
  );
}
