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
    <div className="login-shell">
      <aside className="login-aside">
        <div className="login-aside-inner">
          <div className="story-heading">
            <span>Success Story</span>
            <div className="story-underline" />
          </div>

          <article className="story-card">
            <span className="story-quote-mark" aria-hidden="true">“</span>
            <p className="story-quote">
              “This is what a successful partnership looks like. What I really
              appreciate about iMocha is your clarity on what’s feasible, when,
              and how. You listen, adapt, and move with us — always staying
              ahead. That’s exactly what reassures us.”
            </p>
            <p className="story-author">— Nathalie Clemont</p>
            <p className="story-author-title">
              Global Head of Digital E-commerce &amp; CMI Upskilling,
              <br />
              L’Oréal Group
            </p>
          </article>

          <div className="story-partnership">
            <div className="story-partnership-tag">
              <img src="/imocha-logo.jpeg" alt="iMocha" />
              <span className="story-x">×</span>
              <span className="story-loreal">L’ORÉAL</span>
            </div>
            <div className="story-partnership-title">
              A Partnership for
              <br />
              Skills-Based Development
            </div>
          </div>
        </div>
      </aside>

      <main className="login-panel">
        <form onSubmit={submit} className="login-panel-inner">
          <img src="/imocha-logo.jpeg" alt="iMocha" className="login-brand" />

          <h1 className="login-heading">
            Good to see you!
            <br />
            Log in and make things happen
          </h1>

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
      </main>
    </div>
  );
}
