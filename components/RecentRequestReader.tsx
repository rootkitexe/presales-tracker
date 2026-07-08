'use client';

import { useEffect, useRef, useState } from 'react';
import type { JdFile } from '@/lib/types';
import { fileIcon, fileSize, fmtDate } from '@/lib/format';
import { viewJdFile } from '@/lib/files';

interface Recipient {
  name?: string;
  address?: string;
}

interface FetchedBody {
  ok: true;
  subject: string;
  body: { contentType: string; content: string };
  from: Recipient | null;
  to: Recipient[];
  cc: Recipient[];
  receivedAt: string | null;
}

interface Props {
  recentId: string;
  subject: string | null;
  fromName: string | null;
  fromEmail: string;
  receivedAt: string;
  attachments: JdFile[];
  showToast: (msg: string, type?: '' | 'ok' | 'err') => void;
  onClose: () => void;
  onAdd: () => void;
  onDismiss: () => void;
}

function fmtAddress(r: Recipient): string {
  if (r.name && r.address) return `${r.name} <${r.address}>`;
  return r.address ?? r.name ?? '';
}

export default function RecentRequestReader({
  recentId,
  subject,
  fromName,
  fromEmail,
  receivedAt,
  attachments,
  showToast,
  onClose,
  onAdd,
  onDismiss,
}: Props) {
  const [data, setData] = useState<FetchedBody | null>(null);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/recent-requests/${recentId}/body`);
        const json = await res.json();
        if (cancelled) return;
        if (!json.ok) {
          setError(json.error ?? 'Failed to load body');
          return;
        }
        setData(json);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recentId]);

  // When body loads and is HTML, inject it into the iframe via srcdoc.
  useEffect(() => {
    if (!data || !iframeRef.current) return;
    const isHtml = data.body.contentType.toLowerCase().includes('html');
    if (!isHtml) return;
    // Wrap raw HTML in a minimal document with a base font style.
    const wrapper = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            html, body { margin: 0; padding: 12px; font-family: 'Segoe UI', system-ui, sans-serif; font-size: 13.5px; color: #0f0f10; line-height: 1.55; }
            a { color: #ea5b17; }
            img { max-width: 100%; height: auto; }
            table { max-width: 100%; }
            blockquote { border-left: 3px solid #e8e6e0; padding-left: 12px; color: #6b6860; margin: 8px 0; }
          </style>
        </head>
        <body>${data.body.content}</body>
      </html>
    `;
    iframeRef.current.srcdoc = wrapper;
  }, [data]);

  const time = new Date(receivedAt).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="overlay" onClick={onClose}>
      <div className="rr-reader" onClick={(e) => e.stopPropagation()}>
        <div className="rr-reader-hdr">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="rr-reader-title">{subject || '(no subject)'}</div>
            <div className="rr-reader-meta">
              <strong>From:</strong> {fromName ? `${fromName} <${fromEmail}>` : fromEmail}
            </div>
            {data?.to?.length ? (
              <div className="rr-reader-meta">
                <strong>To:</strong> {data.to.map(fmtAddress).join(', ')}
              </div>
            ) : null}
            {data?.cc?.length ? (
              <div className="rr-reader-meta">
                <strong>Cc:</strong> {data.cc.map(fmtAddress).join(', ')}
              </div>
            ) : null}
            <div className="rr-reader-meta">
              <strong>Date:</strong> {time}
            </div>
          </div>
          <button className="mclose" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="rr-reader-body">
          {!data && !error && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <span className="spinner" />
              <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--muted)' }}>
                Loading full email…
              </div>
            </div>
          )}
          {error && (
            <div className="empty" style={{ padding: 30, color: 'var(--danger)' }}>
              Couldn't load message: {error}
            </div>
          )}
          {data && (
            <>
              {data.body.contentType.toLowerCase().includes('html') ? (
                <iframe
                  ref={iframeRef}
                  className="rr-reader-iframe"
                  sandbox=""
                  title="Email body"
                />
              ) : (
                <pre className="rr-reader-text">{data.body.content}</pre>
              )}
            </>
          )}
        </div>

        {attachments.length > 0 && (
          <div className="rr-reader-attach">
            <div className="rr-reader-attach-title">Attachments ({attachments.length})</div>
            <div className="rr-reader-attach-list">
              {attachments.map((f, i) => (
                <button
                  key={i}
                  className="v2-file-link"
                  onClick={() => viewJdFile(f)}
                  title={f.name}
                >
                  <span className="v2-file-icon">{fileIcon(f.name, f.type)}</span>
                  <span className="v2-file-name">{f.name}</span>
                  <span className="v2-file-size">{fileSize(f.size)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="rr-reader-ftr">
          <span style={{ fontSize: 11.5, color: 'var(--subtle)' }}>
            Received {fmtDate(receivedAt.slice(0, 10))}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={onDismiss}>
              Dismiss
            </button>
            <button
              className="btn btn-p"
              onClick={() => {
                onAdd();
                onClose();
              }}
            >
              + Add to Tracker
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
