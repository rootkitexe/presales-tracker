-- Presales Tracker — database schema.
-- Run this once in the Supabase dashboard: SQL Editor → New query → paste → Run.

create extension if not exists pgcrypto;

create table if not exists public.records (
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

-- Keep updated_at fresh on every update.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists records_set_updated_at on public.records;
create trigger records_set_updated_at
  before update on public.records
  for each row execute function public.set_updated_at();

-- Row Level Security: lock the table down completely.
-- The app reaches this table only via the service-role key from server-side
-- API routes, and the service role bypasses RLS. With RLS enabled and no
-- policies, the public anon key cannot read or write anything.
alter table public.records enable row level security;
