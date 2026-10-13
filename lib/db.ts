// Server-side Postgres client.
//
// Only imported by API route handlers (server, behind the password gate). The
// browser never talks to the database — all data access goes through /api/*.
//
// On Railway, set DATABASE_URL on the app service to the private URL
// (${{Postgres.DATABASE_URL}}); locally, use the database's public URL.

import postgres from 'postgres';

type Sql = ReturnType<typeof postgres>;

// Reuse one pool across hot reloads in dev.
const globalForDb = globalThis as unknown as { __sql?: Sql };

/** Returns the shared connection pool. Throws a clear error if not configured. */
export function getSql(): Sql {
  if (globalForDb.__sql) return globalForDb.__sql;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('Database is not configured. Set DATABASE_URL in .env.local — see README.md.');
  }
  globalForDb.__sql = postgres(url, {
    // Railway's private network is plain TCP; its public proxy offers TLS.
    ssl: 'prefer',
    max: 5,
    idle_timeout: 30,
  });
  return globalForDb.__sql;
}

/** Wraps a value as a jsonb parameter. (postgres.js's own `sql.json` typing
 *  rejects plain interfaces like JdFile[], so values are cast here once.) */
export function json(value: unknown) {
  return getSql().json(value as postgres.JSONValue);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a syntactically valid uuid — lets routes 404 instead of a Postgres cast error. */
export function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}
