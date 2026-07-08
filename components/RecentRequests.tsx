'use client';

import { useCallback, useEffect, useState } from 'react';
import type { JdFile, RecordInput } from '@/lib/types';
import { personFromEmail } from '@/lib/am-list';
import { parseCustomerFromSubject } from '@/lib/subject-parser';
import { fileIcon, fileSize } from '@/lib/format';

interface RecentRequest {
  id: string;
  ms_message_id: string;
  from_name: string | null;
  from_email: string;
  subject: string | null;
  body_preview: string | null;
  received_at: string;
  has_attachments: boolean;
  attachments: Array<{
    name: string;
    contentType?: string;
    size?: number;
    dataUrl?: string;
  }>;
  status: string;
}

interface Props {
  showToast: (msg: string, type?: '' | 'ok' | 'err') => void;
  onAddToTracker: (initial: Partial<RecordInput>, sourceId: string) => void;
  /** Bumped by parent (App) to force refetch after conversion. */
  refreshTick?: number;
}

function relTime(iso: string): string {
  const d = new Date(iso).getTime();
  if (isNaN(d)) return '—';
  const diff = Date.now() - d;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'yesterday';
  if (day < 7) return `${day}d ago`;
  const dt = new Date(iso);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Turn Graph-format attachments into JdFile shape. Filters out inline images. */
function toJdFiles(atts: RecentRequest['attachments']): JdFile[] {
  return atts
    .filter((a) => {
      const type = a.contentType?.toLowerCase() ?? '';
      const name = (a.name ?? '').toLowerCase();
      // Skip inline images that are usually signature logos etc.
      if (type.startsWith('image/') && (a.size ?? 0) < 200_000) return false;
      if (/^image\d{3,}/.test(name)) return false;
      return !!a.dataUrl;
    })
    .map((a) => ({
      name: a.name,
      size: a.size ?? 0,
      type: a.contentType ?? '',
      dataUrl: a.dataUrl!,
    }));
}

export default function RecentRequests({ showToast, onAddToTracker, refreshTick }: Props) {
  const [items, setItems] = useState<RecentRequest[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/recent-requests');
      const data = await res.json();
      if (data.ok) setItems(data.items);
      else showToast(data.error ?? 'Failed to load', 'err');
    } catch (e) {
      showToast((e as Error).message, 'err');
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load, refreshTick]);

  async function dismiss(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/recent-requests/${id}/dismiss`, { method: 'POST' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? 'dismiss failed');
      setItems((prev) => (prev ? prev.filter((r) => r.id !== id) : prev));
      showToast('Dismissed', 'ok');
    } catch (e) {
      showToast((e as Error).message, 'err');
    } finally {
      setBusyId(null);
    }
  }

  function handleAdd(req: RecentRequest) {
    const person = personFromEmail(req.from_email) ?? '';
    const customer = parseCustomerFromSubject(req.subject) ?? '';
    const date = req.received_at.slice(0, 10);
    const initial: Partial<RecordInput> = {
      person,
      customer,
      status: 'Ongoing',
      date,
      notes: req.body_preview?.trim() ?? '',
      jd_files: toJdFiles(req.attachments),
    };
    onAddToTracker(initial, req.id);
  }

  if (items === null) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <span className="spinner" />
        <div style={{ marginTop: 10, fontSize: 13, color: 'var(--muted)' }}>
          Loading recent requests…
        </div>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="empty" style={{ padding: 60 }}>
        No pending requests. Click <strong>↓ Poll</strong> in the header to check for new mail.
      </div>
    );
  }

  return (
    <div className="rr-list">
      {items.map((req) => {
        const person = personFromEmail(req.from_email);
        const customer = parseCustomerFromSubject(req.subject);
        const jds = toJdFiles(req.attachments);
        return (
          <div className="rr-card" key={req.id}>
            <div className="rr-head">
              <div className="rr-from">
                <span className="rr-from-name">{req.from_name ?? req.from_email}</span>
                {person && person !== req.from_name && (
                  <span className="rr-from-mapped"> → {person}</span>
                )}
                <span className="rr-time">· {relTime(req.received_at)}</span>
              </div>
              <div className="rr-actions">
                <button
                  className="btn"
                  onClick={() => dismiss(req.id)}
                  disabled={busyId === req.id}
                >
                  Dismiss
                </button>
                <button
                  className="btn btn-p"
                  onClick={() => handleAdd(req)}
                  disabled={busyId === req.id}
                >
                  + Add to Tracker
                </button>
              </div>
            </div>

            <div className="rr-subject">{req.subject || '(no subject)'}</div>

            {customer && (
              <div className="rr-parsed">
                <span className="rr-parsed-label">Detected customer:</span>{' '}
                <strong>{customer}</strong>
              </div>
            )}

            {req.body_preview && (
              <div className="rr-preview">{req.body_preview.trim()}</div>
            )}

            {jds.length > 0 && (
              <div className="rr-attach">
                {jds.map((f, i) => (
                  <span className="jd-chip" key={i} title={f.name}>
                    {fileIcon(f.name, f.type)} {f.name} · {fileSize(f.size)}
                  </span>
                ))}
              </div>
            )}
            {req.has_attachments && !jds.length && (
              <div className="rr-attach-note">
                (attachments filtered out — only inline images)
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}