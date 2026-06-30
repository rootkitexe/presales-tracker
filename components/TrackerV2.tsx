'use client';

import { useEffect, useMemo, useState } from 'react';

const PAGE_SIZE = 25;
import type { PresalesRecord } from '@/lib/types';
import { deleteRecord } from '@/lib/api';
import { getInitials, avatarColor } from '@/lib/avatar';
import { statusBadgeClass, taraBadgeClass, fmtDate, fileIcon, fileSize } from '@/lib/format';
import { viewJdFile } from '@/lib/files';
import type { ConfirmOptions } from './ConfirmDialog';

interface Props {
  records: PresalesRecord[];
  reload: () => Promise<void>;
  showToast: (msg: string, type?: '' | 'ok' | 'err') => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  onEdit: (r: PresalesRecord) => void;
}

type FilterKey = 'all' | 'active' | 'going-well' | 'won' | 'lost' | 'on-hold' | 'contracting';

const FILTERS: { key: FilterKey; label: string; match?: (s: string) => boolean }[] = [
  { key: 'all', label: 'All Requests' },
  { key: 'active', label: 'Active', match: (s) => /ongoing/i.test(s) },
  { key: 'going-well', label: 'Going Well', match: (s) => /going well/i.test(s) },
  { key: 'won', label: 'Closed Won', match: (s) => /^closed$|^closed.*won/i.test(s.trim()) },
  { key: 'lost', label: 'Lost', match: (s) => /lost|not won|not going/i.test(s) },
  { key: 'on-hold', label: 'On Hold', match: (s) => /hold/i.test(s) },
  { key: 'contracting', label: 'Contracting', match: (s) => /contract/i.test(s) },
];

function relativeTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso).getTime();
  if (isNaN(d)) return '—';
  const diff = Date.now() - d;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'Yesterday';
  if (day < 7) return `${day}d ago`;
  return fmtDate(iso);
}

const FolderIcon = ({ color = '#FF6A2E' }: { color?: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path
      d="M3 7a2 2 0 0 1 2-2h4.586a1 1 0 0 1 .707.293l1.414 1.414A1 1 0 0 0 12.414 7H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
      fill={color}
      opacity="0.18"
    />
    <path
      d="M3 9a2 2 0 0 1 2-2h4.586a1 1 0 0 1 .707.293l1.414 1.414A1 1 0 0 0 12.414 9H19a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"
      fill={color}
    />
  </svg>
);

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

function DetailPanel({
  record,
  onClose,
  onEdit,
  onDelete,
}: {
  record: PresalesRecord;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [tab, setTab] = useState<'assessments' | 'files' | 'activity'>('assessments');
  const personColor = avatarColor(record.person || '?');

  return (
    <>
    <div className="v2-detail-scroll">
      <div className="v2-detail-head">
        <FolderIcon color="#FF6A2E" />
        <button className="v2-detail-close" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
      </div>

      <h3 className="v2-detail-title">{record.customer || 'Untitled request'}</h3>
      <div className="v2-detail-meta">
        {record.assessments.length} {record.assessments.length === 1 ? 'assessment' : 'assessments'}
        {' · '}
        {fmtDate(record.date)}
        {' · '}
        {record.jd_files.length} {record.jd_files.length === 1 ? 'JD' : 'JDs'}
      </div>

      <div className="v2-detail-section">
        <div className="v2-detail-section-head">
          <span className="v2-detail-section-title">Tags</span>
        </div>
        <div className="v2-tag-row">
          {record.status && <span className={'badge ' + statusBadgeClass(record.status)}>{record.status}</span>}
          {record.tara && <span className={'badge ' + taraBadgeClass(record.tara)}>{record.tara}</span>}
          {record.account && <span className="badge b-none">{record.account}</span>}
        </div>
      </div>

      <div className="v2-detail-section">
        <div className="v2-detail-section-head">
          <span className="v2-detail-section-title">Sales Person</span>
        </div>
        <div className="v2-detail-person">
          <span className="avatar v2-detail-avatar" style={{ background: personColor.bg, color: personColor.fg }}>
            {getInitials(record.person || '?')}
          </span>
          <span className="v2-detail-person-name">{record.person || '—'}</span>
        </div>
      </div>

      {record.notes && (
        <div className="v2-detail-section">
          <div className="v2-detail-section-head">
            <span className="v2-detail-section-title">Notes</span>
          </div>
          <div className="v2-detail-notes">{record.notes}</div>
        </div>
      )}

      <div className="v2-detail-tabs">
        <button
          className={'v2-detail-tab' + (tab === 'assessments' ? ' active' : '')}
          onClick={() => setTab('assessments')}
        >
          Assessments
        </button>
        <button
          className={'v2-detail-tab' + (tab === 'files' ? ' active' : '')}
          onClick={() => setTab('files')}
        >
          JD Files
        </button>
        <button
          className={'v2-detail-tab' + (tab === 'activity' ? ' active' : '')}
          onClick={() => setTab('activity')}
        >
          Activity
        </button>
      </div>

      <div className="v2-detail-tab-body">
        {tab === 'assessments' && (
          record.assessments.length ? (
            <ul className="v2-asmt-list">
              {record.assessments.map((a, i) => (
                <li className="v2-asmt-item" key={i}>
                  <div className="v2-asmt-name">{a.name || `Assessment ${i + 1}`}</div>
                  {a.qb && <div className="v2-asmt-qb">{a.qb}</div>}
                </li>
              ))}
            </ul>
          ) : <div className="v2-detail-empty">No assessments yet.</div>
        )}
        {tab === 'files' && (
          record.jd_files.length ? (
            <ul className="v2-file-list">
              {record.jd_files.map((f, i) => (
                <li className="v2-file-item" key={i}>
                  <button className="v2-file-link" onClick={() => viewJdFile(f)}>
                    <span className="v2-file-icon">{fileIcon(f.name, f.type)}</span>
                    <span className="v2-file-name">{f.name}</span>
                    <span className="v2-file-size">{fileSize(f.size)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <div className="v2-detail-empty">No JD files attached.</div>
        )}
        {tab === 'activity' && (
          <ul className="v2-activity-list">
            {record.updated_at && (
              <li className="v2-activity-item">
                <span className="v2-activity-dot" />
                <div>
                  <div className="v2-activity-text">Last updated</div>
                  <div className="v2-activity-time">{relativeTime(record.updated_at)}</div>
                </div>
              </li>
            )}
            {record.created_at && (
              <li className="v2-activity-item">
                <span className="v2-activity-dot" />
                <div>
                  <div className="v2-activity-text">Created</div>
                  <div className="v2-activity-time">{relativeTime(record.created_at)}</div>
                </div>
              </li>
            )}
            {!record.created_at && !record.updated_at && (
              <div className="v2-detail-empty">No activity recorded.</div>
            )}
          </ul>
        )}
      </div>

    </div>

    <div className="v2-detail-actions">
      <button className="btn btn-p" onClick={onEdit}>
        Edit Request
      </button>
      <button className="btn btn-d" onClick={onDelete}>
        Delete
      </button>
    </div>
    </>
  );
}

export default function TrackerV2({ records, reload, showToast, confirm, onEdit }: Props) {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const activeFilter = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];

  const filtered = useMemo(() => {
    let rs = records;
    if (activeFilter.match) rs = rs.filter((r) => activeFilter.match!(r.status));
    if (search.trim()) {
      const q = search.toLowerCase();
      rs = rs.filter(
        (r) =>
          r.person.toLowerCase().includes(q) ||
          r.customer.toLowerCase().includes(q) ||
          r.status.toLowerCase().includes(q) ||
          r.account.toLowerCase().includes(q),
      );
    }
    return rs;
  }, [records, activeFilter, search]);

  useEffect(() => {
    setPage(1);
  }, [filter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const paged = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  const selected = filtered.find((r) => r.id === selectedId) ?? null;

  const activeCount = useMemo(
    () => records.filter((r) => /ongoing/i.test(r.status)).length,
    [records],
  );

  async function handleDelete() {
    if (!selected) return;
    const ok = await confirm({
      title: 'Delete this request?',
      msg: `${selected.customer || 'This request'} will be permanently removed.`,
      okLabel: 'Delete',
      okClass: 'btn-d',
    });
    if (!ok) return;
    try {
      await deleteRecord(selected.id);
      showToast('Request deleted.', 'ok');
      setSelectedId(null);
      await reload();
    } catch (e) {
      showToast((e as Error).message, 'err');
    }
  }

  const total = records.length;
  const pipelinePct = total > 0 ? (activeCount / total) * 100 : 0;

  return (
    <div className="v2-shell notranslate" translate="no">
      <aside className="v2-side">
        <div className="v2-side-section">
          <div className="v2-side-title">Browse</div>
          {FILTERS.map((f) => {
            const count = f.match
              ? records.filter((r) => f.match!(r.status)).length
              : records.length;
            return (
              <button
                key={f.key}
                className={'v2-side-item' + (filter === f.key ? ' active' : '')}
                onClick={() => {
                  setFilter(f.key);
                  setSelectedId(null);
                }}
                type="button"
              >
                <span className="v2-side-label">{f.label}</span>
                <span className="v2-side-count">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="v2-side-foot">
          <div className="v2-pipeline">
            <div className="v2-pipeline-head">
              <span className="v2-pipeline-label">Pipeline</span>
              <span className="v2-pipeline-pct">{Math.round(pipelinePct)}%</span>
            </div>
            <div className="v2-pipeline-bar">
              <div className="v2-pipeline-fill" style={{ width: `${pipelinePct}%` }} />
            </div>
            <div className="v2-pipeline-text">
              {activeCount} of {total} active
            </div>
          </div>
        </div>
      </aside>

      <div className="v2-main">
        <div className="v2-card v2-list-card">
          <div className="v2-list-head">
            <div className="v2-list-title-row">
              <span className="v2-list-title">{activeFilter.label}</span>
              <span className="v2-list-count">{filtered.length}</span>
            </div>
            <div className="v2-list-tools">
              <div className="v2-search">
                <span className="v2-search-icon"><SearchIcon /></span>
                <input
                  type="text"
                  placeholder="Search requests..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="v2-table-wrap">
            <table className="v2-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Sales Person</th>
                  <th>Status</th>
                  <th>TARA</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r) => {
                  const c = avatarColor(r.person || '?');
                  const isSelected = selectedId === r.id;
                  return (
                    <tr
                      key={r.id}
                      className={isSelected ? 'v2-row-selected' : ''}
                      onClick={() => setSelectedId(isSelected ? null : r.id)}
                    >
                      <td>
                        <div className="v2-cust-cell">
                          <FolderIcon color="#FF6A2E" />
                          <div className="v2-cust-text">
                            <div className="v2-cust-name">{r.customer || '—'}</div>
                            <div className="v2-cust-meta">
                              {r.assessments.length} {r.assessments.length === 1 ? 'assessment' : 'assessments'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="v2-person-cell">
                          <span
                            className="avatar v2-mini-avatar"
                            style={{ background: c.bg, color: c.fg }}
                          >
                            {getInitials(r.person || '?')}
                          </span>
                          <span className="v2-person-name">{r.person || '—'}</span>
                        </div>
                      </td>
                      <td>
                        {r.status ? (
                          <span className={'badge ' + statusBadgeClass(r.status)}>{r.status}</span>
                        ) : '—'}
                      </td>
                      <td>
                        {r.tara ? (
                          <span className={'badge ' + taraBadgeClass(r.tara)}>{r.tara}</span>
                        ) : '—'}
                      </td>
                      <td className="v2-date-cell">{fmtDate(r.date)}</td>
                    </tr>
                  );
                })}
                {!paged.length && (
                  <tr>
                    <td colSpan={5} className="v2-empty-cell">
                      No requests match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > PAGE_SIZE && (
            <div className="v2-pager">
              <div className="v2-pager-info">
                Showing <strong>{pageStart + 1}</strong>–
                <strong>{Math.min(pageStart + PAGE_SIZE, filtered.length)}</strong> of{' '}
                <strong>{filtered.length}</strong>
              </div>
              <div className="v2-pager-controls">
                <button
                  className="btn"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  type="button"
                >
                  ← Prev
                </button>
                <span className="v2-pager-page">
                  Page {page} of {totalPages}
                </span>
                <button
                  className="btn"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  type="button"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {selected && (
        <aside className="v2-detail">
          <DetailPanel
            record={selected}
            onClose={() => setSelectedId(null)}
            onEdit={() => onEdit(selected)}
            onDelete={handleDelete}
          />
        </aside>
      )}
    </div>
  );
}
