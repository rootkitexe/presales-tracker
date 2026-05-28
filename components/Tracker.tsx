'use client';

import { Fragment, useRef, useState } from 'react';
import type { PresalesRecord } from '@/lib/types';
import { deleteRecord, updateRecord, toInput } from '@/lib/api';
import { readFilesAsJd, viewJdFile } from '@/lib/files';
import { statusBadgeClass, taraBadgeClass, fmtDate, fileIcon, fileSize } from '@/lib/format';
import type { ConfirmOptions } from './ConfirmDialog';

interface Props {
  records: PresalesRecord[];
  reload: () => Promise<void>;
  showToast: (msg: string, type?: '' | 'ok' | 'err') => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  onEdit: (record: PresalesRecord) => void;
}

export default function Tracker({ records, reload, showToast, confirm, onEdit }: Props) {
  const [search, setSearch] = useState('');
  const [fPerson, setFPerson] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fTara, setFTara] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedJd, setExpandedJd] = useState<string | null>(null);
  const [jdBusy, setJdBusy] = useState(false);
  const jdInputRef = useRef<HTMLInputElement>(null);
  const jdTarget = useRef<string | null>(null);

  const persons = [...new Set(records.map((r) => r.person.trim()).filter(Boolean))].sort();
  const statuses = [...new Set(records.map((r) => r.status.trim()).filter(Boolean))].sort();

  const filtered = records.filter((r) => {
    if (fPerson && r.person.trim() !== fPerson) return false;
    if (fStatus && r.status !== fStatus) return false;
    if (fTara === 'yes' && !r.tara) return false;
    if (fTara === 'no' && r.tara) return false;
    if (search) {
      const hay = [
        r.person,
        r.customer,
        r.status,
        r.account,
        r.tara,
        ...r.assessments.map((a) => a.name + ' ' + a.qb),
      ]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const total = records.length;
  const active = records.filter((r) => /ongoing|going well|contracting/i.test(r.status)).length;
  const won = records.filter((r) => /^closed$/i.test(r.status.trim())).length;
  const taraSet = records.filter((r) => r.tara).length;
  const assessCount = records.reduce((s, r) => s + r.assessments.length, 0);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function del(rec: PresalesRecord) {
    const ok = await confirm({
      icon: '🗑️',
      title: 'Delete Record?',
      msg: `This will permanently remove "${rec.customer}" (requested by ${rec.person}). This cannot be undone.`,
      okLabel: 'Yes, Delete',
      okClass: 'btn-d',
    });
    if (!ok) return;
    try {
      await deleteRecord(rec.id);
      await reload();
      showToast(`Deleted "${rec.customer}"`, 'ok');
    } catch (e) {
      showToast((e as Error).message, 'err');
    }
  }

  function triggerJd(id: string) {
    jdTarget.current = id;
    jdInputRef.current?.click();
  }

  async function onJdFiles(list: FileList | null) {
    const id = jdTarget.current;
    if (!list || !list.length || !id) return;
    const rec = records.find((r) => r.id === id);
    if (!rec) return;
    setJdBusy(true);
    try {
      const files = await readFilesAsJd(Array.from(list));
      await updateRecord(rec.id, toInput({ ...rec, jd_files: [...rec.jd_files, ...files] }));
      await reload();
      setExpandedJd(rec.id);
      showToast(`✓ ${files.length} JD file(s) added`, 'ok');
    } catch (e) {
      showToast((e as Error).message, 'err');
    }
    setJdBusy(false);
  }

  async function removeJd(rec: PresalesRecord, idx: number) {
    setJdBusy(true);
    try {
      await updateRecord(
        rec.id,
        toInput({ ...rec, jd_files: rec.jd_files.filter((_, i) => i !== idx) }),
      );
      await reload();
    } catch (e) {
      showToast((e as Error).message, 'err');
    }
    setJdBusy(false);
  }

  function clearFilters() {
    setSearch('');
    setFPerson('');
    setFStatus('');
    setFTara('');
  }

  return (
    <div>
      <input
        ref={jdInputRef}
        type="file"
        className="fhide"
        multiple
        accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
        onChange={(e) => {
          onJdFiles(e.target.files);
          e.target.value = '';
        }}
      />

      <div className="stats">
        <Stat label="Total" value={total} />
        <Stat label="Active" value={active} color="var(--accent)" />
        <Stat label="Closed Won" value={won} color="var(--success)" />
        <Stat label="TARA Set" value={taraSet} color="var(--purple)" />
        <Stat label="Assessments" value={assessCount} />
      </div>

      <div className="filters">
        <div className="sw">
          <span className="si">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer, person, assessment…"
          />
        </div>
        <select value={fPerson} onChange={(e) => setFPerson(e.target.value)}>
          <option value="">All People</option>
          {persons.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {statuses.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select value={fTara} onChange={(e) => setFTara(e.target.value)}>
          <option value="">TARA: All</option>
          <option value="yes">TARA: Set</option>
          <option value="no">TARA: Not Set</option>
        </select>
        <button className="btn btn-d" onClick={clearFilters}>
          Clear
        </button>
      </div>

      <div className="tw">
        <table>
          <thead>
            <tr>
              <th style={{ width: 100 }}>Date</th>
              <th style={{ width: 115 }}>Requested By</th>
              <th style={{ width: 125 }}>Customer</th>
              <th style={{ width: 105 }}>Status</th>
              <th style={{ width: 170 }}>Assessments</th>
              <th style={{ width: 65 }}>TARA</th>
              <th style={{ width: 90 }}>JD Files</th>
              <th style={{ width: 75 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!filtered.length && (
              <tr>
                <td colSpan={8} className="empty">
                  No records match.
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const isExp = expanded.has(r.id);
              const first = r.assessments[0] ?? { name: '—', qb: '' };
              const label =
                first.name && first.name.length > 26
                  ? first.name.slice(0, 24) + '…'
                  : first.name || '—';
              const hasMore = r.assessments.length > 1 || !!first.qb;
              return (
                <Fragment key={r.id}>
                  <tr>
                    <td>{fmtDate(r.date)}</td>
                    <td style={{ fontWeight: 500 }} title={r.person}>
                      {r.person || '—'}
                    </td>
                    <td title={r.customer}>{r.customer || '—'}</td>
                    <td>
                      <span className={'badge ' + statusBadgeClass(r.status)}>
                        {r.status || '—'}
                      </span>
                    </td>
                    <td>
                      <span title={first.name}>{label}</span>
                      {hasMore && (
                        <button
                          onClick={() => toggleExpand(r.id)}
                          style={{
                            fontSize: 10.5,
                            color: 'var(--accent)',
                            background: 'var(--al)',
                            border: 'none',
                            borderRadius: 4,
                            padding: '2px 6px',
                            cursor: 'pointer',
                            marginLeft: 4,
                          }}
                        >
                          {isExp ? '▲' : '▼'}{' '}
                          {r.assessments.length > 1 ? '+' + (r.assessments.length - 1) : 'QB'}
                        </button>
                      )}
                    </td>
                    <td>
                      <span className={'badge ' + taraBadgeClass(r.tara)}>{r.tara || '—'}</span>
                    </td>
                    <td>
                      {r.jd_files.length ? (
                        <button
                          className="jd-chip"
                          onClick={() => setExpandedJd(expandedJd === r.id ? null : r.id)}
                          title={r.jd_files.map((f) => f.name).join('\n')}
                        >
                          ✓ {r.jd_files.length} file{r.jd_files.length > 1 ? 's' : ''}
                        </button>
                      ) : (
                        <button className="jd-up" onClick={() => triggerJd(r.id)}>
                          📎 Upload
                        </button>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                        <button className="edit-btn" title="Edit" onClick={() => onEdit(r)}>
                          ✏️
                        </button>
                        <button className="del-btn" title="Delete" onClick={() => del(r)}>
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>

                  {isExp && (
                    <tr>
                      <td
                        colSpan={8}
                        style={{
                          padding: '10px 16px 12px 22px',
                          background: '#f7f8ff',
                        }}
                      >
                        {first.qb && (
                          <Detail label="QB Topics">{first.qb}</Detail>
                        )}
                        {r.account && <Detail label="Account">{r.account}</Detail>}
                        {r.notes && <Detail label="Notes">{r.notes}</Detail>}
                        {r.assessments.length > 1 && (
                          <div>
                            <div
                              style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                color: 'var(--muted)',
                                textTransform: 'uppercase',
                                marginBottom: 4,
                              }}
                            >
                              All Assessments
                            </div>
                            {r.assessments.map((a, ai) => (
                              <div
                                key={ai}
                                style={{
                                  padding: '5px 8px',
                                  background: 'var(--surface)',
                                  border: '1px solid var(--border)',
                                  borderRadius: 6,
                                  marginBottom: 4,
                                }}
                              >
                                <div style={{ fontSize: 12, fontWeight: 500 }}>
                                  {ai + 1}. {a.name || '—'}
                                </div>
                                {a.qb && (
                                  <div
                                    style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}
                                  >
                                    {a.qb}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}

                  {expandedJd === r.id && (
                    <tr>
                      <td colSpan={8} style={{ padding: '12px 14px', background: '#f0f4ff' }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 10,
                          }}
                        >
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
                            📎 JD Files — {r.customer || r.person}
                          </span>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              className="btn btn-p"
                              style={{ padding: '3px 10px', fontSize: 11.5 }}
                              onClick={() => triggerJd(r.id)}
                              disabled={jdBusy}
                            >
                              + Add Files
                            </button>
                            <button
                              className="btn"
                              style={{ padding: '3px 8px', fontSize: 12 }}
                              onClick={() => setExpandedJd(null)}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                        {r.jd_files.length ? (
                          r.jd_files.map((f, fi) => (
                            <div className="jd-file-row" key={fi}>
                              <span style={{ fontSize: 16 }}>{fileIcon(f.name, f.type)}</span>
                              <span className="jd-fname">{f.name}</span>
                              <span className="jd-fsize">{fileSize(f.size)}</span>
                              <button
                                className="btn btn-p"
                                style={{ padding: '2px 8px', fontSize: 11 }}
                                onClick={() => viewJdFile(f)}
                              >
                                👁
                              </button>
                              <a
                                href={f.dataUrl}
                                download={f.name}
                                className="btn"
                                style={{ padding: '2px 8px', fontSize: 11 }}
                              >
                                ↓
                              </a>
                              <button
                                className="btn btn-d"
                                style={{ padding: '2px 8px', fontSize: 11 }}
                                onClick={() => removeJd(r, fi)}
                                disabled={jdBusy}
                              >
                                ✕
                              </button>
                            </div>
                          ))
                        ) : (
                          <p style={{ fontSize: 12, color: 'var(--muted)' }}>No JD files yet.</p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--muted)' }}>
        {filtered.length
          ? `Showing ${filtered.length} of ${total} request${total === 1 ? '' : 's'}`
          : ''}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="sc">
      <div className="sc-label">{label}</div>
      <div className="sc-val" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          color: 'var(--muted)',
          textTransform: 'uppercase',
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 12 }}>{children}</div>
    </div>
  );
}
