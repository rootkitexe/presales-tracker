'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.replace('/');
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Login failed.');
    } catch {
      setError('Network error — please try again.');
    }
    setLoading(false);
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'var(--bg)',
      }}
    >
      <form
        onSubmit={submit}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '32px',
          width: '100%',
          maxWidth: '360px',
          boxShadow: '0 8px 32px rgba(0,0,0,.08)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔒</div>
          <div style={{ fontSize: '18px', fontWeight: 700 }}>
            Presales <span style={{ color: 'var(--accent)' }}>Tracker</span>
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginTop: '4px' }}>
            Enter the shared password to continue.
          </div>
        </div>

        <label className="fl">Password</label>
        <input
          className="fi"
          type="password"
          value={password}
          autoFocus
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••••••"
        />

        {error && (
          <div
            style={{
              marginTop: '10px',
              fontSize: '12px',
              color: 'var(--danger)',
              background: 'var(--dl)',
              border: '1px solid #f5c6c2',
              borderRadius: '7px',
              padding: '7px 10px',
            }}
          >
            {error}
          </div>
        )}

        <button
          className="btn btn-p"
          type="submit"
          disabled={loading || !password}
          style={{ width: '100%', marginTop: '16px', justifyContent: 'center' }}
        >
          {loading ? 'Checking…' : 'Unlock'}
        </button>
      </form>
    </div>
  );
}
