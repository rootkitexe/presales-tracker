'use client';

import type { CSSProperties, ReactNode } from 'react';
import type { PresalesRecord } from '@/lib/types';
import { getInitials, avatarColor } from '@/lib/avatar';

function normKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[-–]\s*/g, '-');
}

function isWon(s: string): boolean {
  const t = s.trim().toLowerCase();
  return t === 'closed' || /^closed[\s-]*won/.test(t);
}
function isLost(s: string): boolean {
  return /lost|not won|not going/i.test(s);
}
function isActive(s: string): boolean {
  return /ongoing|going well|contracting/i.test(s);
}

function statusColor(label: string): string {
  const l = label.toLowerCase();
  if (/lost|not won|not going/.test(l)) return 'var(--danger)';
  if (/^closed$|^closed[\s-]*won/.test(l)) return 'var(--success)';
  if (/hold/.test(l)) return 'var(--warn)';
  if (/well/.test(l)) return '#15803d';
  if (/contract/.test(l)) return 'var(--accent-2)';
  if (/ongoing/.test(l)) return 'var(--accent)';
  return 'var(--subtle)';
}

function taraColor(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('not')) return 'var(--danger)';
  if (l.includes('created')) return 'var(--accent-2)';
  return 'var(--subtle)';
}

type BarRow = { key: string; label: string; value: number };

function Scoreboard({ data }: { data: BarRow[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="scoreboard">
      {data.map((d, i) => {
        const c = avatarColor(d.label);
        return (
          <div className="sb-row" key={d.key}>
            <span className="sb-rank">{i + 1}</span>
            <span
              className="avatar sb-avatar"
              style={{ background: c.bg, color: c.fg }}
            >
              {getInitials(d.label)}
            </span>
            <span className="sb-name" title={d.label}>
              {d.label}
            </span>
            <div className="sb-bar-track">
              <div
                className="sb-bar-fill"
                style={{
                  width: `${(d.value / max) * 100}%`,
                  background: c.fg,
                }}
              />
            </div>
            <span className="sb-val">{d.value}</span>
          </div>
        );
      })}
    </div>
  );
}

function StackedBar({
  data,
  colorize,
}: {
  data: BarRow[];
  colorize: (label: string) => string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="stacked">
      <div className="stacked-total">
        <span className="stacked-total-val">{total}</span>
        <span className="stacked-total-label">total tagged</span>
      </div>
      <div className="stacked-bar" role="img" aria-label="TARA distribution">
        {data.map((d) => {
          const pct = total > 0 ? (d.value / total) * 100 : 0;
          return (
            <div
              key={d.key}
              className="stacked-seg"
              style={{ width: `${pct}%`, background: colorize(d.label) }}
              title={`${d.label}: ${d.value} (${pct.toFixed(0)}%)`}
            />
          );
        })}
      </div>
      <div className="stacked-legend">
        {data.map((d) => {
          const pct = total > 0 ? (d.value / total) * 100 : 0;
          return (
            <div className="stacked-row" key={d.key}>
              <span className="legend-dot" style={{ background: colorize(d.label) }} />
              <span className="stacked-label">{d.label}</span>
              <span className="stacked-pct">{pct.toFixed(0)}%</span>
              <span className="stacked-cnt">{d.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Donut({
  data,
  colorize,
  centerLabel,
}: {
  data: BarRow[];
  colorize: (label: string) => string;
  centerLabel?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const size = 168;
  const radius = 64;
  const stroke = 18;
  const circumference = 2 * Math.PI * radius;

  let acc = 0;
  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`translate(${size / 2}, ${size / 2}) rotate(-90)`}>
          <circle r={radius} fill="none" stroke="var(--surface2)" strokeWidth={stroke} />
          {data.map((d) => {
            const fraction = total > 0 ? d.value / total : 0;
            const dashLen = circumference * fraction;
            const seg = (
              <circle
                key={d.key}
                r={radius}
                fill="none"
                stroke={colorize(d.label)}
                strokeWidth={stroke}
                strokeDasharray={`${dashLen} ${circumference - dashLen}`}
                strokeDashoffset={-acc}
                style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}
              />
            );
            acc += dashLen;
            return seg;
          })}
        </g>
        <text
          x={size / 2}
          y={size / 2 - 4}
          textAnchor="middle"
          fontSize="10.5"
          fontWeight="600"
          fill="var(--muted)"
          style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}
        >
          {centerLabel ?? 'Total'}
        </text>
        <text
          x={size / 2}
          y={size / 2 + 20}
          textAnchor="middle"
          fontSize="26"
          fontWeight="700"
          fill="var(--text)"
          style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}
        >
          {total}
        </text>
      </svg>
      <div className="donut-legend">
        {data.map((d) => (
          <div className="legend-row" key={d.key}>
            <span className="legend-dot" style={{ background: colorize(d.label) }} />
            <span className="legend-label" title={d.label}>
              {d.label}
            </span>
            <span className="legend-val">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function group(
  records: PresalesRecord[],
  pick: (r: PresalesRecord) => string | undefined,
): BarRow[] {
  const map = new Map<string, BarRow>();
  for (const r of records) {
    const raw = pick(r);
    if (!raw) continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = normKey(trimmed);
    const existing = map.get(key);
    if (existing) {
      existing.value += 1;
    } else {
      map.set(key, { key, label: trimmed, value: 1 });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.value - a.value);
}

const accentStyle = (color: string): CSSProperties =>
  ({ ['--sc-accent' as string]: color }) as CSSProperties;

// Inline lucide-style icons (no new deps)
const Icon = {
  Layers: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12.83 2.18 8.36 4.04a1 1 0 0 1 0 1.8L12.83 12.06a2 2 0 0 1-1.66 0L2.81 8.02a1 1 0 0 1 0-1.8l8.36-4.04a2 2 0 0 1 1.66 0Z" />
      <path d="m22 12-9.17 4.04a2 2 0 0 1-1.66 0L2 12" />
      <path d="m22 17-9.17 4.04a2 2 0 0 1-1.66 0L2 17" />
    </svg>
  ),
  Trophy: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  ),
  XCircle: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  ),
  Activity: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.5.5 0 0 1-.96 0L9.24 2.18a.5.5 0 0 0-.96 0l-2.35 8.36A2 2 0 0 1 4 12H2" />
    </svg>
  ),
  Clipboard: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  ),
};

function StatCard({
  label,
  value,
  sub,
  valueColor,
  accent,
  icon,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  valueColor?: string;
  accent: string;
  icon: ReactNode;
}) {
  return (
    <div className="sc" style={accentStyle(accent)}>
      <div className="sc-head">
        <div className="sc-label">{label}</div>
        <span className="sc-icon">{icon}</span>
      </div>
      <div className="sc-val" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </div>
      {sub ? <div className="sc-sub">{sub}</div> : null}
    </div>
  );
}

export default function Dashboard({ records }: { records: PresalesRecord[] }) {
  const total = records.length;
  const won = records.filter((r) => isWon(r.status)).length;
  const lost = records.filter((r) => isLost(r.status)).length;
  const active = records.filter((r) => isActive(r.status)).length;
  const assessments = records.reduce((s, r) => s + r.assessments.length, 0);
  const byStatus = group(records, (r) => r.status || 'Unknown');
  const byPerson = group(records, (r) => r.person);
  const byTara = group(records, (r) => r.tara);

  return (
    <div>
      <div className="dash-hdr">
        <div>
          <h2 className="dash-title">Pipeline Overview</h2>
          <div className="dash-sub">Live view of all presales activity</div>
        </div>
        <div className="dash-meta">
          {total} {total === 1 ? 'request' : 'requests'} · {byPerson.length} salespeople
        </div>
      </div>

      <div className="stats">
        <StatCard
          accent="var(--accent-2)"
          icon={<Icon.Layers />}
          label="Total"
          value={total}
        />
        <StatCard
          accent="var(--success)"
          icon={<Icon.Trophy />}
          label="Closed Won"
          valueColor="var(--success)"
          value={won}
        />
        <StatCard
          accent="var(--danger)"
          icon={<Icon.XCircle />}
          label="Lost"
          valueColor="var(--danger)"
          value={lost}
        />
        <StatCard
          accent="var(--accent)"
          icon={<Icon.Activity />}
          label="Active"
          valueColor="var(--accent)"
          value={active}
        />
        <StatCard
          accent="var(--accent-2)"
          icon={<Icon.Clipboard />}
          label="Assessments"
          value={assessments}
        />
      </div>

      <div className="charts" style={{ marginTop: 18 }}>
        <div className="cc">
          <div className="ct">By Status</div>
          {byStatus.length ? (
            <Donut data={byStatus} colorize={statusColor} centerLabel="Total" />
          ) : (
            <div className="empty" style={{ padding: 12 }}>
              No data yet.
            </div>
          )}
        </div>
        <div className="cc">
          <div className="ct">By Sales Person</div>
          {byPerson.length ? (
            <Scoreboard data={byPerson} />
          ) : (
            <div className="empty" style={{ padding: 12 }}>
              No data yet.
            </div>
          )}
        </div>
        <div className="cc">
          <div className="ct">TARA Usage</div>
          {byTara.length ? (
            <StackedBar data={byTara} colorize={taraColor} />
          ) : (
            <div className="empty" style={{ padding: 12 }}>
              No TARA data yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
