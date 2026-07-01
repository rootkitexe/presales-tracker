// Microsoft OAuth 2.0 helper — single-user flow (one connected account per app instance).
// Tokens are stored in the singleton `ms_account` row keyed by id = 'default'.

import { createClient } from '@supabase/supabase-js';

const TENANT = process.env.AZURE_AD_TENANT_ID!;
const CLIENT_ID = process.env.AZURE_AD_CLIENT_ID!;
const CLIENT_SECRET = process.env.AZURE_AD_CLIENT_SECRET!;
const REDIRECT_URI = `${process.env.NEXTAUTH_URL}/api/auth/callback/azure-ad`;

const AUTH_ORIGIN = `https://login.microsoftonline.com/${TENANT}`;
const SCOPES = ['openid', 'profile', 'email', 'offline_access', 'Mail.Read'];

const supabase = () =>
  createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export interface MsAccount {
  id: string;
  ms_user_id: string | null;
  ms_email: string | null;
  ms_name: string | null;
  access_token: string;
  refresh_token: string;
  expires_at: string; // ISO
  scope: string | null;
  connected_at: string;
  updated_at: string;
  last_polled_at: string | null;
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

/** Fetches the signed-in Microsoft user's profile via Graph. */
export async function fetchMsProfile(accessToken: string): Promise<{
  id: string;
  displayName: string;
  userPrincipalName: string;
  mail: string | null;
}> {
  const res = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`graph /me failed: ${res.status}`);
  return res.json();
}

/** Stores tokens + profile in the singleton `ms_account` row. */
export async function saveAccount(tokens: TokenResponse): Promise<MsAccount> {
  const profile = await fetchMsProfile(tokens.access_token);
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  const { data, error } = await supabase()
    .from('ms_account')
    .upsert(
      {
        id: 'default',
        ms_user_id: profile.id,
        ms_email: profile.mail ?? profile.userPrincipalName,
        ms_name: profile.displayName,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        scope: tokens.scope ?? SCOPES.join(' '),
      },
      { onConflict: 'id' },
    )
    .select()
    .single();
  if (error) throw error;
  return data as MsAccount;
}

/** Returns the singleton account row, or null if not connected. */
export async function getAccount(): Promise<MsAccount | null> {
  const { data, error } = await supabase().from('ms_account').select('*').eq('id', 'default').maybeSingle();
  if (error) throw error;
  return data as MsAccount | null;
}

/** Returns a valid access token, refreshing if within 60s of expiry. */
export async function getValidAccessToken(): Promise<string | null> {
  const acct = await getAccount();
  if (!acct) return null;
  const expiresMs = new Date(acct.expires_at).getTime();
  if (expiresMs - Date.now() > 60_000) return acct.access_token;

  const refreshed = await refreshAccessToken(acct.refresh_token);
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await supabase()
    .from('ms_account')
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token, // MS may rotate; always write back
      expires_at: newExpiresAt,
      scope: refreshed.scope ?? acct.scope,
    })
    .eq('id', 'default');
  return refreshed.access_token;
}

/** Removes the stored account (disconnect). */
export async function disconnect(): Promise<void> {
  await supabase().from('ms_account').delete().eq('id', 'default');
}
