'use client';

import { useRef, useState } from 'react';
import type { Assessment, JdFile, PresalesRecord, RecordInput } from '@/lib/types';
import { STATUS_OPTIONS, TARA_OPTIONS } from '@/lib/constants';
import { createRecords, updateRecord } from '@/lib/api';
import { readFilesAsJd } from '@/lib/files';
import { fileIcon, fileSize } from '@/lib/format';
import AssessmentsEditor from './AssessmentsEditor';

interface Props {
  record: PresalesRecord | null; // null = new request
  persons: string[];
  reload: () => Promise<void>;
  showToast: (msg: string, type?: '' | 'ok' | 'err') => void;
  onClose: () => void;
  /** Pre-fill values for a new request (only used when record is null). */
  initial?: Partial<RecordInput>;
  /** Fired after a successful save (create or update). Passes the input just saved. */
  onSaved?: (input: RecordInput) => void;
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

export default function RecordModal({
  record,
  persons,
  reload,
  showToast,
  onClose,
  initial,
  onSaved,
}: Props) {
  const seed = record ?? initial;
  const [person, setPerson] = useState(seed?.person ?? '');
  const [customer, setCustomer] = useState(seed?.customer ?? '');
  const [date, setDate] = useState(seed?.date ?? '');
  const [status, setStatus] = useState(seed?.status ?? '');
  const [account, setAccount] = useState(seed?.account ?? '');
  const [tara, setTara] = useState(seed?.tara ?? '');
  const [notes, setNotes] = useState(seed?.notes ?? '');
  const [assessments, setAssessments] = useState<Assessment[]>(
    seed?.assessments?.length ? seed.assessments : [{ name: '', qb: '' }],
  );
  const [jd, setJd] = useState<JdFile[]>(seed?.jd_files ?? []);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const lastWeek = new Date();
  lastWeek.setDate(today.getDate() - 7);
  const shortcuts = [
    { label: 'Today', val: ymd(today) },
    { label: 'Yesterday', val: ymd(yesterday) },
    { label: 'Last week', val: ymd(lastWeek) },
  ];

  async function attach(list: FileList | null) {
    if (!list || !list.length) return;
    const files = await readFilesAsJd(Array.from(list));
    setJd((prev) => [...prev, ...files]);
  }

  async function save() {
    if (!person.trim() || !customer.trim()) {
      showToast('Request From and Customer Name are required.', 'err');
      return;
    }
    const cleaned = assessments
      .map((a) => ({ name: a.name.trim(), qb: a.qb.trim() }))
      .filter((a) => a.name);
    const payload: RecordInput = {
      person: person.trim(),
      customer: customer.trim(),
      status,
      date,
      account: account.trim(),
      tara,
      notes: notes.trim(),
      assessments: cleaned,
      jd_files: jd,
    };
    setSaving(true);
    try {
      if (record) await updateRecord(record.id, payload);
      else await createRecords([payload]);
      await reload();
      showToast(record ? '✓ Record updated' : '✓ Record added', 'ok');
      onSaved?.(payload);
      onClose();
    } catch (e) {
      showToast((e as Error).message, 'err');
      setSaving(false);
    }
  }

  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="mhdr">
          <div className="mtitle">{record ? 'Edit Request' : 'New Request'}</div>
          <button className="mclose" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="mbody">
          <div className="fr2">
            <div className="fr">
              <label className="fl">Request From *</label>
              <div className="combo-wrap">
                <input
                  className="fi"
                  list="modal-person-list"
                  value={person}
                  onChange={(e) => setPerson(e.target.value)}
                  placeholder="Type or select name"
                />
                <datalist id="modal-person-list">
                  {persons.map((p) => (
                    <option value={p} key={p} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className="fr">
              <label className="fl">Customer Name *</label>
              <input
                className="fi"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                placeholder="e.g. Frasers Property"
              />
            </div>
          </div>

          <div className="fr2">
            <div className="fr">
              <label className="fl">Date Received</label>
              <input
                className="fi"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <div style={{ marginTop: 5, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {shortcuts.map((s) => (
                  <button
                    type="button"
                    key={s.label}
                    className="btn"
                    style={{ padding: '2px 9px', fontSize: 10.5 }}
                    onClick={() => setDate(s.val)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="fr">
              <label className="fl">Status</label>
              <select className="fi" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">— Select —</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="fr2">
            <div className="fr">
              <label className="fl">Account (Email)</label>
              <input
                className="fi"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder="email@domain.com"
              />
            </div>
            <div className="fr">
              <label className="fl">TARA Status</label>
              <select className="fi" value={tara} onChange={(e) => setTara(e.target.value)}>
                <option value="">— Not Requested —</option>
                {TARA_OPTIONS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="fr">
            <label className="fl">JD Files</label>
            <div
              style={{
                border: '1.5px dashed var(--border)',
                borderRadius: 7,
                padding: '10px 12px',
                background: 'var(--surface2)',
              }}
            >
              {jd.map((f, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '5px 8px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    marginBottom: 5,
                  }}
                >
                  <span style={{ fontSize: 14 }}>{fileIcon(f.name, f.type)}</span>
                  <span
                    style={{
                      flex: 1,
                      fontSize: 12,
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {f.name}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{fileSize(f.size)}</span>
                  <button
                    type="button"
                    onClick={() => setJd((prev) => prev.filter((_, idx) => idx !== i))}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--muted)',
                      fontSize: 13,
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <input
                  ref={fileRef}
                  type="file"
                  className="fhide"
                  multiple
                  accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                  onChange={(e) => {
                    attach(e.target.files);
                    e.target.value = '';
                  }}
                />
                <span className="jd-up">📎 Attach files</span>
              </label>
              <span style={{ fontSize: 10.5, color: 'var(--muted)', marginLeft: 8 }}>
                PDF, Word, TXT, images
              </span>
            </div>
          </div>

          <div className="fr">
            <label className="fl">Assessments &amp; QB Topics</label>
            <AssessmentsEditor value={assessments} onChange={setAssessments} />
          </div>

          <div className="fr">
            <label className="fl">Notes</label>
            <input
              className="fi"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any extra notes"
            />
          </div>
        </div>

        <div className="mftr">
          <button className="btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-p" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
