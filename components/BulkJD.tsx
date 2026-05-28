'use client';

import { useRef, useState } from 'react';
import type { JdFile, PresalesRecord } from '@/lib/types';
import { updateRecord, toInput } from '@/lib/api';
import { readFilesAsJd } from '@/lib/files';
import { fileIcon, fileSize } from '@/lib/format';

interface Props {
  records: PresalesRecord[];
  reload: () => Promise<void>;
  showToast: (msg: string, type?: '' | 'ok' | 'err') => void;
}

interface BulkFile extends JdFile {
  assignedTo: string; // record id, or ''
}

export default function BulkJD({ records, reload, showToast }: Props) {
  const [files, setFiles] = useState<BulkFile[]>([]);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function addFiles(list: FileList | null) {
    if (!list || !list.length) return;
    const jd = await readFilesAsJd(Array.from(list));
    setFiles((prev) => [...prev, ...jd.map((f) => ({ ...f, assignedTo: '' }))]);
  }

  async function commit() {
    const groups = new Map<string, JdFile[]>();
    files.forEach((f) => {
      if (!f.assignedTo) return;
      const list = groups.get(f.assignedTo) ?? [];
      list.push({ name: f.name, size: f.size, type: f.type, dataUrl: f.dataUrl });
      groups.set(f.assignedTo, list);
    });
    if (!groups.size) {
      showToast('Assign at least one file to a record first.', 'err');
      return;
    }
    setBusy(true);
    try {
      let assigned = 0;
      for (const [id, newFiles] of groups) {
        const rec = records.find((r) => r.id === id);
        if (!rec) continue;
        await updateRecord(id, toInput({ ...rec, jd_files: [...rec.jd_files, ...newFiles] }));
        assigned += newFiles.length;
      }
      await reload();
      const skipped = files.length - assigned;
      showToast(`✓ ${assigned} JD file(s) saved`, 'ok');
      if (skipped > 0) showToast(`⚠️ ${skipped} file(s) skipped (not assigned)`);
      setFiles([]);
    } catch (e) {
      showToast((e as Error).message, 'err');
    }
    setBusy(false);
  }

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>
          Bulk JD Upload &amp; Assignment
        </h2>
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>
          Upload multiple JD files and assign each to the correct customer record.
        </p>
      </div>

      <div
        className={'dropzone' + (drag ? ' drag' : '')}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          addFiles(e.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          className="fhide"
          multiple
          accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <div style={{ fontSize: 32, marginBottom: 8 }}>📎</div>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
          Click or drag &amp; drop JD files here
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          PDF, Word, TXT, images · Select multiple at once
        </div>
      </div>

      {files.map((f, i) => (
        <div className="jd-file-row" key={i}>
          <span style={{ fontSize: 18 }}>{fileIcon(f.name, f.type)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="jd-fname">{f.name}</div>
            <div className="jd-fsize">{fileSize(f.size)}</div>
          </div>
          {f.assignedTo && <span className="assigned-tag">✓ Assigned</span>}
          <select
            className="assign-sel"
            value={f.assignedTo}
            onChange={(e) =>
              setFiles((prev) =>
                prev.map((x, idx) => (idx === i ? { ...x, assignedTo: e.target.value } : x)),
              )
            }
          >
            <option value="">— Assign to record —</option>
            {records.map((r) => (
              <option value={r.id} key={r.id}>
                {r.customer || r.person}
                {r.customer && r.person ? ` — ${r.person}` : ''}
              </option>
            ))}
          </select>
          <button
            className="btn btn-d"
            style={{ padding: '2px 8px', fontSize: 11 }}
            onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
          >
            ✕
          </button>
        </div>
      ))}

      {files.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn btn-p" onClick={commit} disabled={busy}>
            {busy ? 'Saving…' : '✓ Save Assignments'}
          </button>
          <button className="btn" onClick={() => setFiles([])} disabled={busy}>
            ✕ Clear All
          </button>
        </div>
      )}
    </div>
  );
}
