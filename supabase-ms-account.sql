-- Microsoft account tokens (singleton row).
-- Run this in the Supabase SQL editor to create the table.

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

-- Auto-update updated_at on write.
create or replace function ms_account_touch() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists ms_account_touch on ms_account;
create trigger ms_account_touch
before update on ms_account
for each row execute function ms_account_touch();
