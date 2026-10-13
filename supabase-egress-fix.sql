-- Egress fix — run once in the Supabase SQL editor (after the other three .sql files).
--
-- JD files and email attachments are stored as base64 inside jsonb columns.
-- Selecting those columns ships every file's bytes out of the database on every
-- list request, which is what used up the egress quota. The views below return
-- the same rows with the file bytes stripped (names / sizes / types only); the
-- functions let the API add, fetch, and remove a single file without reading or
-- re-sending the whole array.

-- Records list without JD file bytes.
-- security_invoker makes the view honour the RLS on `records`, so the anon key
-- still cannot read it (the service role used by the API bypasses RLS).
create or replace view public.records_list
with (security_invoker = true) as
select
  id, person, customer, status, account, tara, notes, date, assessments,
  coalesce(
    (select jsonb_agg(f - 'dataUrl') from jsonb_array_elements(jd_files) f),
    '[]'::jsonb
  ) as jd_files,
  created_at, updated_at
from public.records;

-- Pending email list without attachment bytes. `hasData` records whether the
-- stored attachment has content, so the UI can still filter out empty ones.
create or replace view public.recent_requests_list
with (security_invoker = true) as
select
  id, ms_message_id, from_name, from_email, subject, body_preview, received_at,
  has_attachments, status, processed_record_id, processed_at, created_at,
  coalesce(
    (select jsonb_agg((a - 'dataUrl') || jsonb_build_object('hasData', a ? 'dataUrl'))
       from jsonb_array_elements(attachments) a),
    '[]'::jsonb
  ) as attachments
from public.recent_requests;

-- Append files to a record's jd_files.
create or replace function public.append_jd_files(p_id uuid, p_files jsonb)
returns void language sql as $$
  update public.records set jd_files = jd_files || p_files where id = p_id;
$$;

-- Return one JD file (with bytes) by array index.
create or replace function public.get_jd_file(p_id uuid, p_idx int)
returns jsonb language sql stable as $$
  select jd_files -> p_idx from public.records where id = p_id;
$$;

-- Remove one JD file by index. The name must match too, so a stale index from
-- a concurrent edit cannot delete the wrong file.
create or replace function public.remove_jd_file(p_id uuid, p_idx int, p_name text)
returns boolean language sql as $$
  with u as (
    update public.records set jd_files = jd_files - p_idx
    where id = p_id and jd_files -> p_idx ->> 'name' = p_name
    returning 1
  )
  select exists (select 1 from u);
$$;

-- Only the server (service role) may call these.
revoke execute on function public.append_jd_files(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.get_jd_file(uuid, int) from public, anon, authenticated;
revoke execute on function public.remove_jd_file(uuid, int, text) from public, anon, authenticated;
grant execute on function public.append_jd_files(uuid, jsonb) to service_role;
grant execute on function public.get_jd_file(uuid, int) to service_role;
grant execute on function public.remove_jd_file(uuid, int, text) to service_role;

-- Lock down the Outlook tables the same way as `records` (no policies = anon
-- key gets nothing; the API uses the service role). ms_account holds the
-- Microsoft refresh token.
alter table public.ms_account enable row level security;
alter table public.recent_requests enable row level security;
