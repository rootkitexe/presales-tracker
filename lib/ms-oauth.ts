// Microsoft OAuth 2.0 helper — single-user flow (one connected account per app instance).
// Tokens are stored in the singleton `ms_account` row keyed by id = 'default'.

import { getSql } from './db';

const TENANT = process.env.AZURE_AD_TENANT_ID!;
const CLIENT_ID = process.env.AZURE_AD_CLIENT_ID!;
const CLIENT_SECRET = process.env.AZURE_AD_CLIENT_SECRET!;
const REDIRECT_URI = `${process.env.NEXTAUTH_URL}/api/auth/callback/azure-ad`;

const AUTH_ORIGIN = `https://login.microsoftonline.com/${TENANT}`;
const SCOPES = ['openid', 'profile', 'email', 'offline_access', 'Mail.Read'];

export interface MsAccount {
  id: string;
  ms_user_id: string | null;
  ms_email: string | null;
  ms_name: string | null;
  access_token: string;
  refresh_token: string;
  expires_at: Date;
  scope: string | null;
  connected_at: Date;
  updated_at: Date;
  last_polled_at: Date | null;
  last_poll_error: string | null;
}

/** Builds the Microsoft consent URL. `state` is CSRF-verified in the callback. */
export function authUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    response_mode: 'query',
    scope: SCOPES.join(' '),
    state,
    prompt: 'select_account',
  });
  return `${AUTH_ORIGIN}/oauth2/v2.0/authorize?${params}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
  id_token?: string;
}

/** Exchanges an authorization code for tokens. */
export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
    scope: SCOPES.join(' '),
  });
  const res = await fetch(`${AUTH_ORIGIN}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`token exchange failed: ${data.error_description ?? JSON.stringify(data)}`);
  }
  return data as TokenResponse;
}

/** Uses a refresh token to obtain a new access token. */
export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: SCOPES.join(' '),
  });
  const res = await fetch(`${AUTH_ORIGIN}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`token refresh failed: ${data.error_description ?? JSON.stringify(data)}`);
  }
  return data as TokenResponse;
}

interface IdTokenClaims {
  oid?: string;
  sub?: string;
  email?: string;
  preferred_username?: string;
  upn?: string;
  name?: string;
}

/** Decodes the JWT payload without signature verification. */
function decodeIdToken(idToken: string): IdTokenClaims {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('invalid id_token');
  const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
}

/** Stores tokens + profile (from id_token) in the singleton `ms_account` row. */
export async function saveAccount(tokens: TokenResponse): Promise<MsAccount> {
  if (!tokens.id_token) throw new Error('no id_token in response');
  const claims = decodeIdToken(tokens.id_token);
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  const row = {
    id: 'default',
    ms_user_id: claims.oid ?? claims.sub ?? null,
    ms_email: claims.email ?? claims.preferred_username ?? claims.upn ?? null,
    ms_name: claims.name ?? null,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt,
    scope: tokens.scope ?? SCOPES.join(' '),
  };
  const sql = getSql();
  const [acct] = await sql<MsAccount[]>`
    insert into ms_account ${sql(row)}
    on conflict (id) do update set
      ms_user_id = excluded.ms_user_id, ms_email = excluded.ms_email,
      ms_name = excluded.ms_name, access_token = excluded.access_token,
      refresh_token = excluded.refresh_token, expires_at = excluded.expires_at,
      scope = excluded.scope
    returning *`;
  return acct;
}

/** Returns the singleton account row, or null if not connected. */
export async function getAccount(): Promise<MsAccount | null> {
  const [acct] = await getSql()<MsAccount[]>`select * from ms_account where id = 'default'`;
  return acct ?? null;
}

/** Returns a valid access token, refreshing if within 60s of expiry. */
export async function getValidAccessToken(): Promise<string | null> {
  const acct = await getAccount();
  if (!acct) return null;
  const expiresMs = new Date(acct.expires_at).getTime();
  if (expiresMs - Date.now() > 60_000) return acct.access_token;

  const refreshed = await refreshAccessToken(acct.refresh_token);
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  // MS may rotate the refresh token; always write it back.
  await getSql()`
    update ms_account set
      access_token = ${refreshed.access_token}, refresh_token = ${refreshed.refresh_token},
      expires_at = ${newExpiresAt}, scope = ${refreshed.scope ?? acct.scope}
    where id = 'default'`;
  return refreshed.access_token;
}

/** Removes the stored account (disconnect). */
export async function disconnect(): Promise<void> {
  await getSql()`delete from ms_account where id = 'default'`;
}
