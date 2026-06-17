'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchHubspotDeals,
  fetchHubspotCompanies,
  type HubspotDeal,
  type HubspotCompany,
} from '@/lib/api';

type SubTab = 'deals' | 'companies';

function fmtAmount(raw?: string) {
  if (!raw) return '—';
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return n.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function fmtDate(raw?: string) {
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtCity(c?: string, country?: string) {
  const parts = [c, country].filter(Boolean);
  return parts.length ? parts.join(', ') : '—';
}

function dealUrl(portalId: string | null, id: string) {
  if (!portalId) return null;
  return `https://app.hubspot.com/contacts/${portalId}/record/0-3/${id}`;
}

function companyUrl(portalId: string | null, id: string) {
  if (!portalId) return null;
  return `https://app.hubspot.com/contacts/${portalId}/record/0-2/${id}`;
}

const idChipStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 6,
  background: '#f1f5f9',
  color: '#475569',
  fontSize: 11.5,
  fontFamily: 'var(--font-mono, ui-monospace, monospace)',
};

const labelChipStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '3px 10px',
  borderRadius: 999,
  background: 'rgba(109, 40, 217, 0.08)',
  color: '#5b21b6',
  fontSize: 12,
  fontWeight: 600,
};

export default function HubspotTab() {
  const [sub, setSub] = useState<SubTab>('deals');

  return (
    <div>
      <div className="hs-subtabs">
        <button
          type="button"
          className={'hs-subtab' + (sub === 'deals' ? ' active' : '')}
          onClick={() => setSub('deals')}
        >
          Deals
        </button>
        <button
          type="button"
          className={'hs-subtab' + (sub === 'companies' ? ' active' : '')}
          onClick={() => setSub('companies')}
        >
          Companies
        </button>
      </div>

      {sub === 'deals' ? <DealsView /> : <CompaniesView />}
    </div>
  );
}

/* ------------------------- DEALS ------------------------- */

function DealsView() {
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
    <>
      <SearchBar
        query={query}
        setQuery={setQuery}
        onSubmit={onSearch}
        onClear={clearSearch}
        activeQuery={activeQuery}
        total={total}
        loading={loading}
        placeholder="Search deal name…"
      />

      {error && <ErrorBanner message={error} />}

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 260 }}>Deal</th>
              <th style={{ width: 110 }}>Amount</th>
              <th style={{ width: 160 }}>Stage</th>
              <th style={{ width: 140 }}>Pipeline</th>
              <th style={{ width: 150 }}>Owner</th>
              <th style={{ width: 130 }}>Close date</th>
              <th style={{ width: 140 }}>Last modified</th>
              <th style={{ width: 90 }}>Open</th>
            </tr>
          </thead>
          <tbody>
            {loading && deals.length === 0 && <LoadingRow colSpan={8} label="Loading deals…" />}
            {!loading && deals.length === 0 && !error && (
              <EmptyRow colSpan={8} active={activeQuery} entity="deals" />
            )}
            {deals.map((d) => {
              const url = dealUrl(portalId, d.id);
              const stage = d.resolved?.stageLabel;
              const pipeline = d.resolved?.pipelineLabel;
              const owner = d.resolved?.ownerName;
              return (
                <tr key={d.id}>
                  <td>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>
                      {d.properties.dealname || '—'}
                    </span>
                  </td>
                  <td>{fmtAmount(d.properties.amount)}</td>
                  <td>
                    {stage ? (
                      <span style={labelChipStyle}>{stage}</span>
                    ) : (
                      <span style={idChipStyle} title={`Stage ID ${d.properties.dealstage ?? '—'}`}>
                        #{d.properties.dealstage ?? '—'}
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: 12.5, color: 'var(--muted)' }}>{pipeline ?? '—'}</td>
                  <td>{owner ?? '—'}</td>
                  <td>{fmtDate(d.properties.closedate)}</td>
                  <td>{fmtDate(d.properties.hs_lastmodifieddate)}</td>
                  <td>{url ? <OpenLink href={url} /> : <Dash />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {nextAfter && (
        <LoadMore loading={loading} onClick={() => load(activeQuery, nextAfter)} />
      )}
    </>
  );
}

/* ----------------------- COMPANIES ----------------------- */

function CompaniesView() {
  const [companies, setCompanies] = useState<HubspotCompany[]>([]);
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
      const data = await fetchHubspotCompanies({ q, after });
      setCompanies((prev) => (after ? [...prev, ...data.companies] : data.companies));
      setNextAfter(data.paging?.next?.after ?? null);
      setTotal(data.total);
      setPortalId(data.portalId);
    } catch (e) {
      setError((e as Error).message);
      if (!after) setCompanies([]);
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
    <>
      <SearchBar
        query={query}
        setQuery={setQuery}
        onSubmit={onSearch}
        onClear={clearSearch}
        activeQuery={activeQuery}
        total={total}
        loading={loading}
        placeholder="Search company name…"
      />

      {error && <ErrorBanner message={error} />}

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 240 }}>Company</th>
              <th style={{ width: 170 }}>Domain</th>
              <th style={{ width: 150 }}>Industry</th>
              <th style={{ width: 140 }}>Lifecycle</th>
              <th style={{ width: 150 }}>Owner</th>
              <th style={{ width: 160 }}>Location</th>
              <th style={{ width: 90 }}>Open</th>
            </tr>
          </thead>
          <tbody>
            {loading && companies.length === 0 && <LoadingRow colSpan={7} label="Loading companies…" />}
            {!loading && companies.length === 0 && !error && (
              <EmptyRow colSpan={7} active={activeQuery} entity="companies" />
            )}
            {companies.map((c) => {
              const url = companyUrl(portalId, c.id);
              const owner = c.resolved?.ownerName;
              const domain = c.properties.domain || c.properties.website;
              return (
                <tr key={c.id}>
                  <td>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>
                      {c.properties.name || '—'}
                    </span>
                  </td>
                  <td style={{ fontSize: 12.5, color: 'var(--muted)' }}>{domain || '—'}</td>
                  <td>{c.properties.industry || '—'}</td>
                  <td>
                    {c.properties.lifecyclestage ? (
                      <span style={labelChipStyle}>{c.properties.lifecyclestage}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{owner ?? '—'}</td>
                  <td style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                    {fmtCity(c.properties.city, c.properties.country)}
                  </td>
                  <td>{url ? <OpenLink href={url} /> : <Dash />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {nextAfter && (
        <LoadMore loading={loading} onClick={() => load(activeQuery, nextAfter)} />
      )}
    </>
  );
}

/* ----------------------- SHARED BITS ----------------------- */

function SearchBar(props: {
  query: string;
  setQuery: (q: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClear: () => void;
  activeQuery: string;
  total: number | null;
  loading: boolean;
  placeholder: string;
}) {
  return (
    <form
      onSubmit={props.onSubmit}
      style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}
    >
      <input
        className="fi"
        style={{ flex: 1, maxWidth: 380 }}
        placeholder={props.placeholder}
        value={props.query}
        onChange={(e) => props.setQuery(e.target.value)}
      />
      <button className="btn btn-p" type="submit" disabled={props.loading}>
        Search
      </button>
      {props.activeQuery && (
        <button className="btn" type="button" onClick={props.onClear} disabled={props.loading}>
          Clear
        </button>
      )}
      {props.total !== null && (
        <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--muted)' }}>
          {props.total.toLocaleString()} match{props.total === 1 ? '' : 'es'}
          {props.activeQuery && (
            <>
              {' '}
              for <em>“{props.activeQuery}”</em>
            </>
          )}
        </span>
      )}
    </form>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
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
      {message}
    </div>
  );
}

function LoadingRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ textAlign: 'center', padding: 48 }}>
        <span className="spinner" />
        <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--muted)' }}>{label}</div>
      </td>
    </tr>
  );
}

function EmptyRow({
  colSpan,
  active,
  entity,
}: {
  colSpan: number;
  active: string;
  entity: string;
}) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>
        No {entity} found{active ? <> for “{active}”</> : ''}.
      </td>
    </tr>
  );
}

function OpenLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 12.5 }}
    >
      Open ↗
    </a>
  );
}

function Dash() {
  return <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>;
}

function LoadMore({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: 18 }}>
      <button className="btn" onClick={onClick} disabled={loading}>
        {loading ? 'Loading…' : 'Load more'}
      </button>
    </div>
  );
}
