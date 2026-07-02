-- Recent Requests: emails polled from Outlook, queued for review.
-- Run in the Supabase SQL editor. Enable RLS when prompted.

create table if not exists recent_requests (
  id uuid primary key default gen_random_uuid(),
  ms_message_id text unique not null,        -- Graph message ID, for dedup
  from_name text,
  from_email text not null,
  subject text,
  body_preview text,                          -- short snippet from Graph
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
create index if not exists recent_requests_msid_idx
  on recent_requests (ms_message_id);
