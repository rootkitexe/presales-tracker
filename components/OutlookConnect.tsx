'use client';

import { useEffect, useState } from 'react';

interface Status {
  connected: boolean;
  email?: string | null;
  name?: string | null;
}

export default function OutlookConnect({
  showToast,
}: {
  showToast: (msg: string, type?: '' | 'ok' | 'err') => void;
}) {
  const [status, setStatus] = useState<Status>({ connected: false });
  const [loading, setLoading] = useState(false);

  async function refresh() {
    try {
      const res = await fetch('/api/auth/microsoft/status');
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ connected: false });
    }
  }

  useEffect(() => {
    refresh();
    // Surface success or error from OAuth callback redirect (?ms_connected / ?ms_error).
    const url = new URL(window.location.href);
    const connected = url.searchParams.get('ms_connected');
    const error = url.searchParams.get('ms_error');
    if (connected) {
      showToast(`Outlook connected as ${connected}`, 'ok');
      url.searchParams.delete('ms_connected');
      window.history.replaceState({}, '', url.toString());
    }
    if (error) {
      showToast(`Outlook connection failed: ${error}`, 'err');
      url.searchParams.delete('ms_error');
      window.history.replaceState({}, '', url.toString());
    }
  }, [showToast]);

  function connect() {
    window.location.href = '/api/auth/microsoft/login';
  }

  async function disconnect() {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/microsoft/disconnect', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        showToast('Outlook disconnected', 'ok');
        setStatus({ connected: false });
      } else {
        showToast(data.error ?? 'Failed to disconnect', 'err');
      }
    } finally {
      setLoading(false);
    }
  }

  async function pollNow() {
    setLoading(true);
    try {
      const res = await fetch('/api/inbound-mail/poll', { method: 'POST' });
      const data = await res.json();
      if (!data.ok) {
        showToast(`Poll failed: ${data.error ?? 'unknown'}`, 'err');
        return;
      }
      const { newCount, totalChecked, errors } = data;
      const errPart = errors?.length ? ` (${errors.length} errors)` : '';
      showToast(
        `Poll done: ${newCount} new · ${totalChecked} checked${errPart}`,
        newCount > 0 ? 'ok' : '',
      );
    } catch (e) {
      showToast(`Poll failed: ${(e as Error).message}`, 'err');
    } finally {
      setLoading(false);
    }
  }

  if (status.connected) {
    return (
      <>
        <button
          className="btn"
          onClick={pollNow}
          disabled={loading}
          title="Fetch new AM emails from Outlook"
        >
          {loading ? '…' : '↓ Poll'}
        </button>
        <button
          className="btn"
          onClick={disconnect}
          disabled={loading}
          title={`Click to disconnect · Connected: ${status.email ?? 'unknown'}`}
          style={{ color: 'var(--success)', borderColor: '#bbf7d0', background: 'var(--sl)' }}
        >
          ✓ Outlook: {status.email ?? 'connected'}
        </button>
      </>
    );
  }

  return (
    <button className="btn" onClick={connect}>
      🔗 Connect Outlook
    </button>
  );
}
