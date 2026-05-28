'use client';

import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import type { PresalesRecord, RecordInput } from '@/lib/types';
import { createRecords, replaceAllRecords } from '@/lib/api';

interface Props {
  records: PresalesRecord[];
  reload: () => Promise<void>;
  showToast: (msg: string, type?: '' | 'ok' | 'err') => void;
  goToTab: (t: string) => void;
}

type Field =
  | 'date'
  | 'person'
  | 'customer'
  | 'status'
  | 'assessment'
  | 'qb'
  | 'account'
  | 'tara'
  | 'notes';

// Fuzzy column recogniser — maps any reasonable header to an internal field.
const COL_PATTERNS: Record<Field, RegExp[]> = {
  date: [/date/i, /received/i, /when/i],
  person: [/request/i, /from/i, /person/i, /\bby\b/i, /sales/i, /contact/i, /rep/i],
  customer: [/customer/i, /client/i, /company/i, /account.*name/i, /org/i],
  status: [/status/i, /stage/i, /state/i],
  assessment: [/assess/i, /role/i, /position/i, /job title/i, /test/i],
  qb: [/qb/i, /topic/i, /content/i, /question/i, /bank/i],
  account: [/account/i, /email/i, /login/i, /user/i],
  tara: [/tara/i],
  notes: [/note/i, /comment/i, /remark/i, /detail/i, /info/i],
};

const FIELD_LABELS: Record<Field, string> = {
  date: 'Date',
  person: 'Request From *',
  customer: 'Customer Name *',
  status: 'Status',
  assessment: 'Assessment Name',
  qb: 'QB Topics',
  account: 'Account Email',
  tara: 'TARA',
  notes: 'Notes',
};

const FIELDS = Object.keys(FIELD_LABELS) as Field[];

type ColMap = Record<Field, number>;
type ImportRow = RecordInput & { _dup: boolean };

function emptyMap(): ColMap {
  return {
    date: -1,
    person: -1,
    customer: -1,
    status: -1,
    assessment: -1,
    qb: -1,
    account: -1,
    tara: -1,
    notes: -1,
  };
}

function guessColMap(headers: string[]): ColMap {
  const map = emptyMap();
  headers.forEach((h, i) => {
    const hl = String(h).toLowerCase().trim();
    for (const field of FIELDS) {
      if (map[field] === -1 && COL_PATTERNS[field].some((p) => p.test(hl))) {
        map[field] = i;
        break;
      }
    }
  });
  return map;
}

function dupKey(person: string, customer: string) {
  return person.trim().toLowerCase() + '||' + customer.trim().toLowerCase();
}

function fmtImportDate(v: unknown): string {
  if (!v) return '';
  if (v instanceof Date) return v.toISOString().split('T')[0];
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return '';
}

export default function ImportTab({ records, reload, showToast, goToTab }: Props) {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<unknown[][]>([]);
  const [mapping, setMapping] = useState<ColMap>(emptyMap());
  const [imported, setImported] = useState<ImportRow[]>([]);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep('upload');
    setHeaders([]);
    setRows([]);
    setMapping(emptyMap());
    setImported([]);
  }

  function parseFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
        if (grid.length < 2) {
          showToast('File is empty.', 'err');
          return;
        }
        const hdrs = (grid[0] as unknown[]).map((h) => String(h));
        setHeaders(hdrs);
        setRows(grid.slice(1) as unknown[][]);
        setMapping(guessColMap(hdrs));
        setStep('mapping');
      } catch (err) {
        showToast('Parse error: ' + (err as Error).message, 'err');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function cell(row: unknown[], i: number): string {
    return i === -1 ? '' : String(row[i] ?? '').trim();
  }

  function applyMapping() {
    if (mapping.person === -1 || mapping.customer === -1) {
      showToast('Please map at least "Request From" and "Customer Name".', 'err');
      return;
    }
    const existing = new Set(records.map((r) => dupKey(r.person, r.customer)));
    const out: ImportRow[] = [];
    let cur: ImportRow | null = null;
    rows.forEach((row) => {
      const person = cell(row, mapping.person);
      const customer = cell(row, mapping.customer);
      const assName = cell(row, mapping.assessment);
      const qb = cell(row, mapping.qb);
      if (person || customer) {
        cur = {
          person,
          customer,
          status: cell(row, mapping.status),
          date: fmtImportDate(mapping.date === -1 ? '' : row[mapping.date]),
          account: cell(row, mapping.account),
          tara: cell(row, mapping.tara),
          notes: cell(row, mapping.notes),
          assessments: assName ? [{ name: assName, qb }] : [],
          jd_files: [],
          _dup: existing.has(dupKey(person, customer)),
        };
        out.push(cur);
      } else if (cur && assName) {
        cur.assessments.push({ name: assName, qb });
      }
    });
    setImported(out);
    setStep('preview');
  }

  function strip(r: ImportRow): RecordInput {
    const { _dup, ...rest } = r;
    void _dup;
    return rest;
  }

  async function append() {
    const valid = imported.filter((r) => r.person && r.customer && !r._dup);
    if (!valid.length) {
      showToast('No new (non-duplicate) records to append.', 'err');
      return;
    }
    setBusy(true);
    try {
      await createRecords(valid.map(strip));
      await reload();
      showToast(`✓ ${valid.length} record(s) appended (duplicates skipped)`, 'ok');
      reset();
      goToTab('tracker');
    } catch (e) {
      showToast((e as Error).message, 'err');
    }
    setBusy(false);
  }

  async function replace() {
    const valid = imported.filter((r) => r.person && r.customer);
    if (!valid.length) {
      showToast('Nothing to import.', 'err');
      return;
    }
    if (
      !confirm(
        `Replace ALL ${records.length} existing record(s) with ${valid.length} imported record(s)? This cannot be undone.`,
      )
    )
      return;
    setBusy(true);
    try {
      await replaceAllRecords(valid.map(strip));
      await reload();
      showToast(`✓ Tracker replaced with ${valid.length} record(s)`, 'ok');
      reset();
      goToTab('tracker');
    } catch (e) {
      showToast((e as Error).message, 'err');
    }
    setBusy(false);
  }

  function downloadTemplate() {
    const wb = XLSX.utils.book_new();
    const aoa = [
      ['Date Received', 'Request From', 'Customer Name', 'Status', 'Assessment Name', 'QB Topics', 'Account Email', 'TARA', 'Notes'],
      ['2026-04-10', 'John Doe', 'Acme Corp', 'Ongoing', 'Java Developer', 'Core Java, OOP, Spring Boot', 'john@example.com', 'Created', 'Sample note'],
      ['', '', '', '', 'Python Developer', 'Python Basics, Django', '', '', ''],
      ['2026-04-08', 'Jane Smith', 'Beta Ltd', 'Closed', 'Data Analyst', 'SQL, Power BI', 'jane@beta.com', 'Not Created', ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [14, 20, 22, 18, 30, 35, 28, 16, 25].map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, 'Import Data');
    XLSX.writeFile(wb, 'Presales_Import_Template.xlsx');
  }

  const readyCount = imported.filter((r) => r.person && r.customer && !r._dup).length;
  const dupCount = imported.filter((r) => r._dup).length;
  const errCount = imported.filter((r) => !r.person || !r.customer).length;

  return (
    <div style={{ maxWidth: 960 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>Import from Excel</h2>
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>
            Flexible import — columns are auto-detected. Duplicates are detected and skipped.
          </p>
        </div>
        <button className="btn btn-s" onClick={downloadTemplate}>
          📋 Download Template
        </button>
      </div>

      <div
        className={'import-zone' + (drag ? ' drag' : '') + (step !== 'upload' ? ' done' : '')}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files[0];
          if (f) parseFile(f);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          className="fhide"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) parseFile(f);
            e.target.value = '';
          }}
        />
        <div style={{ fontSize: 40, marginBottom: 10 }}>📊</div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
          Click to browse or drag &amp; drop your Excel file
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          .xlsx / .xls / .csv supported · Column names are auto-detected
        </div>
      </div>

      {step === 'mapping' && (
        <div
          style={{
            marginTop: 16,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: 16,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Column Mapping</div>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
            We auto-detected your columns. Adjust if needed, then click <strong>Preview</strong>.
          </p>
          <div className="mapper-grid">
            {FIELDS.map((field) => (
              <FieldRow
                key={field}
                label={FIELD_LABELS[field]}
                headers={headers}
                value={mapping[field]}
                onChange={(v) => setMapping((m) => ({ ...m, [field]: v }))}
              />
            ))}
          </div>
          <button className="btn btn-p" onClick={applyMapping}>
            👁 Preview Records
          </button>
          <button className="btn" onClick={reset} style={{ marginLeft: 8 }}>
            ✕ Cancel
          </button>
        </div>
      )}

      {step === 'preview' && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: 14 }}>
                Preview — {imported.length} row(s)
              </span>
              <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 8 }}>
                {readyCount} new · {dupCount} duplicate(s) · {errCount} error(s)
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={reset} disabled={busy}>
                ✕ Clear
              </button>
              <button className="btn btn-p" onClick={append} disabled={busy}>
                + Append New
              </button>
              <button className="btn btn-d" onClick={replace} disabled={busy}>
                Replace All
              </button>
            </div>
          </div>
          <div
            style={{
              overflowX: 'auto',
              maxHeight: 420,
              overflowY: 'auto',
              border: '1px solid var(--border)',
              borderRadius: 8,
            }}
          >
            <table className="preview-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Request From</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Assessments</th>
                  <th>Date</th>
                  <th>TARA</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {imported.map((r, i) => {
                  const missing = !r.person || !r.customer;
                  const pill = missing
                    ? { text: '❌ Missing fields', cls: 'sp-err' }
                    : r._dup
                      ? { text: '⚠️ Duplicate', cls: 'sp-dup' }
                      : { text: '✅ Ready', cls: 'sp-ok' };
                  return (
                    <tr key={i} style={r._dup ? { opacity: 0.6 } : undefined}>
                      <td>{i + 1}</td>
                      <td>{r.person || '—'}</td>
                      <td>{r.customer || '—'}</td>
                      <td>{r.status || '—'}</td>
                      <td>{r.assessments.length ? r.assessments.map((a) => a.name).join(', ') : '—'}</td>
                      <td>{r.date || '—'}</td>
                      <td>{r.tara || '—'}</td>
                      <td>
                        <span className={'status-pill ' + pill.cls}>{pill.text}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--muted)' }}>
            ✅ Ready · ⚠️ Duplicate (skipped on append) · ❌ Missing required fields
          </div>
        </div>
      )}
    </div>
  );
}

function FieldRow({
  label,
  headers,
  value,
  onChange,
}: {
  label: string;
  headers: string[];
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <>
      <div className="mapper-field">{label}</div>
      <div className="mapper-arrow">→</div>
      <select
        className="mapper-sel"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
      >
        <option value={-1}>— not mapped —</option>
        {headers.map((h, i) => (
          <option value={i} key={i}>
            {h || `(col ${i + 1})`}
          </option>
        ))}
      </select>
    </>
  );
}
