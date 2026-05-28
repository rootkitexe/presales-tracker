'use client';

import type { PresalesRecord } from '@/lib/types';

const COLORS = [
  '#2d5be3',
  '#6d28d9',
  '#1a7a4a',
  '#b45309',
  '#c0392b',
  '#0369a1',
  '#d97706',
  '#059669',
];

function Bars({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...Object.values(data), 1);
  return (
    <>
      {entries.map(([k, v], i) => (
        <div className="bi" key={k}>
          <div className="bl" title={k}>
            {k.length > 18 ? k.slice(0, 16) + '…' : k}
          </div>
          <div className="bt">
            <div
              className="bf"
              style={{ width: `${(v / max) * 100}%`, background: COLORS[i % COLORS.length] }}
            >
              <span className="bv">{v}</span>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

export default function Dashboard({ records }: { records: PresalesRecord[] }) {
  const total = records.length;
  const won = records.filter((r) => /^closed$/i.test(r.status.trim())).length;
  const lost = records.filter((r) => /lost|not won|not going/i.test(r.status)).length;
  const active = records.filter((r) => /ongoing|going well|contracting/i.test(r.status)).length;
  const assessments = records.reduce((s, r) => s + r.assessments.length, 0);

  const byStatus: Record<string, number> = {};
  const byPerson: Record<string, number> = {};
  const byTara: Record<string, number> = {};
  records.forEach((r) => {
    const s = r.status || 'Unknown';
    byStatus[s] = (byStatus[s] || 0) + 1;
    const p = r.person.trim() || 'Unknown';
    byPerson[p] = (byPerson[p] || 0) + 1;
    if (r.tara) byTara[r.tara] = (byTara[r.tara] || 0) + 1;
  });

  return (
    <div>
      <div className="stats">
        <div className="sc">
          <div className="sc-label">Total</div>
          <div className="sc-val">{total}</div>
        </div>
        <div className="sc">
          <div className="sc-label">Closed Won</div>
          <div className="sc-val" style={{ color: 'var(--success)' }}>
            {won}
          </div>
          <div className="sc-sub">Win rate {Math.round((won / Math.max(total, 1)) * 100)}%</div>
        </div>
        <div className="sc">
          <div className="sc-label">Lost</div>
          <div className="sc-val" style={{ color: 'var(--danger)' }}>
            {lost}
          </div>
        </div>
        <div className="sc">
          <div className="sc-label">Active</div>
          <div className="sc-val" style={{ color: 'var(--accent)' }}>
            {active}
          </div>
        </div>
        <div className="sc">
          <div className="sc-label">Assessments</div>
          <div className="sc-val">{assessments}</div>
          <div className="sc-sub">Avg {(assessments / Math.max(total, 1)).toFixed(1)}/req</div>
        </div>
      </div>

      <div className="charts" style={{ marginTop: 14 }}>
        <div className="cc">
          <div className="ct">By Status</div>
          <Bars data={byStatus} />
        </div>
        <div className="cc">
          <div className="ct">By Sales Person</div>
          <Bars data={byPerson} />
        </div>
        <div className="cc">
          <div className="ct">TARA Usage</div>
          {Object.keys(byTara).length ? (
            Object.entries(byTara).map(([k, v], i) => (
              <div className="li" key={k}>
                <div className="ld" style={{ background: COLORS[i % COLORS.length] }} />
                <span>
                  {k}: <strong>{v}</strong>
                </span>
              </div>
            ))
          ) : (
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>No TARA data yet.</span>
          )}
        </div>
      </div>
    </div>
  );
}
