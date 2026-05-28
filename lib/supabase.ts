// Server-side Supabase client.
//
// The client uses the SERVICE ROLE key and is only ever imported by API route
// handlers (which run on the server, behind the password gate). The browser
// never talks to Supabase directly — all data access goes through /api/records.
// Because of that, no Supabase value is exposed to the client bundle.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

/**
 * Returns a singleton service-role Supabase client.
 * Throws a clear error if the env vars have not been filled in yet.
 */
export function getSupabase(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey || url.includes('YOUR-PROJECT')) {
    throw new Error(
      'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY ' +
        'in .env.local — see README.md ("Supabase setup").',
    );
  }

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
