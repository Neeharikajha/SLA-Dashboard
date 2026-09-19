-- Run once in Supabase → SQL Editor, then set SUPABASE_URL / SUPABASE_SERVICE_KEY.

create table if not exists health_checks (
  id bigserial primary key,
  service_id text not null,
  service_name text not null,
  timestamp timestamptz not null,          -- always UTC, set by lib/clean.js
  status_code integer not null check (status_code between 100 and 599),
  latency_ms integer,                       -- null when data_quality_flag = 'missing_latency'
  agent text not null,
  region text,
  data_quality_flag text,
  created_at timestamptz default now(),
  unique (service_id, timestamp, agent)     -- re-uploading the same CSV won't double-insert
);

create index if not exists idx_health_checks_timestamp on health_checks (timestamp);
create index if not exists idx_health_checks_service on health_checks (service_id, timestamp);
