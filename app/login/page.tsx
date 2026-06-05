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
    <div className="login-bg">
      <form onSubmit={submit} className="login-card">
        <div className="login-head">
          <div className="login-mark">🔒</div>
          <h1 className="login-title">
            Presales <span>Tracker</span>
          </h1>
          <p className="login-sub">Enter the shared password to continue</p>
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

        {error && <div className="login-error">{error}</div>}

        <button className="btn btn-p login-cta" type="submit" disabled={loading || !password}>
          {loading ? 'Checking…' : 'Unlock'}
        </button>
      </form>
    </div>
  );
}
