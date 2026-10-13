-- Presales Tracker — database schema (plain Postgres, e.g. Railway).
-- Apply with:  node --env-file=.env.local scripts/db-setup.mjs
-- Safe to re-run: every statement is idempotent.

-- ── records ─────────────────────────────────────────────────────────
create table if not exists records (
  id          uuid primary key default gen_random_uuid(),
  person      text not null,
  customer    text not null,
  status      text not null default '',
  account     text not null default '',
  tara        text not null default '',
  notes       text not null default '',
  date        text not null default '',          -- kept as text for flexible Excel imports
  assessments jsonb not null default '[]'::jsonb, -- [{ name, qb }]
  jd_files    jsonb not null default '[]'::jsonb, -- [{ name, size, type, dataUrl }]
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists records_set_updated_at on records;
create trigger records_set_updated_at
  before update on records
  for each row execute function set_updated_at();

-- ── ms_account: the connected Outlook account (singleton row) ──────
create table if not exists ms_account (
  id text primary key default 'default',
  ms_user_id text,
  ms_email text,
  ms_name text,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text,
  connected_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_polled_at timestamptz,
  last_poll_error text
);

drop trigger if exists ms_account_set_updated_at on ms_account;
create trigger ms_account_set_updated_at
  before update on ms_account
  for each row execute function set_updated_at();

-- ── recent_requests: AM emails polled from Outlook, queued for review ──
create table if not exists recent_requests (
  id uuid primary key default gen_random_uuid(),
  ms_message_id text unique not null,        -- Graph message ID, for dedup
  from_name text,
  from_email text not null,
  subject text,
  body_preview text,
  received_at timestamptz not null,
  attachments jsonb default '[]'::jsonb,      -- [{name, contentType, size, dataUrl}]
  has_attachments boolean default false,
  status text default 'pending',              -- 'pending' | 'processed' | 'dismissed'
  processed_record_id uuid references records(id) on delete set null,
  processed_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists recent_requests_status_received_idx
  on recent_requests (status, received_at desc);

-- ── List views: same rows without file bytes ───────────────────────
-- List endpoints read these so JD files / attachments are only sent when a
-- single file is opened. Never select jd_files/attachments in a list query.
create or replace view records_list as
select
  id, person, customer, status, account, tara, notes, date, assessments,
  coalesce(
    (select jsonb_agg(f - 'dataUrl') from jsonb_array_elements(jd_files) f),
    '[]'::jsonb
  ) as jd_files,
  created_at, updated_at
from records;

-- `hasData` records whether the attachment has content, so the UI can still
-- filter out empty ones.
create or replace view recent_requests_list as
select
  id, ms_message_id, from_name, from_email, subject, body_preview, received_at,
  has_attachments, status, processed_record_id, processed_at, created_at,
  coalesce(
    (select jsonb_agg((a - 'dataUrl') || jsonb_build_object('hasData', a ? 'dataUrl'))
       from jsonb_array_elements(attachments) a),
    '[]'::jsonb
  ) as attachments
from recent_requests;
