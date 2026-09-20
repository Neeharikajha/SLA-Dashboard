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
  filename text,                            -- tracks which CSV upload this row came from
  created_at timestamptz default now(),
  unique (service_id, timestamp, agent)     -- re-uploading the same CSV won't double-insert
);

create index if not exists idx_health_checks_timestamp on health_checks (timestamp);
create index if not exists idx_health_checks_service on health_checks (service_id, timestamp);

-- Both functions implement the multi-agent policy: group rows into (service, timestamp)
-- intervals; an interval is "up" only if every agent that reported it was 2xx.

create or replace function service_stats(filter_filename text default null)
returns table (
  service_id text, service_name text, total_intervals bigint, up_intervals bigint,
  availability_pct numeric, avg_latency_ms numeric
) language sql stable as $$
  with base as (
    select * from health_checks
    where (filter_filename is null or filename = filter_filename)
  ),
  intervals as (
    select service_id, max(service_name) as service_name, timestamp,
      bool_and(status_code between 200 and 299) as up, avg(latency_ms) as latency_ms
    from base group by service_id, timestamp
  )
  select service_id, max(service_name), count(*), count(*) filter (where up),
    round(100.0 * count(*) filter (where up) / nullif(count(*), 0), 3),
    round(avg(latency_ms)::numeric, 1)
  from intervals group by service_id;
$$;

create or replace function overall_stats(filter_filename text default null)
returns table (
  total_intervals bigint, up_intervals bigint, availability_pct numeric,
  total_rows bigint, flagged_rows bigint, data_quality_score numeric,
  min_timestamp timestamptz, max_timestamp timestamptz
) language sql stable as $$
  with base as (
    select * from health_checks
    where (filter_filename is null or filename = filter_filename)
  ),
  intervals as (
    select service_id, timestamp, bool_and(status_code between 200 and 299) as up
    from base group by service_id, timestamp
  )
  select 
    (select count(*) from intervals),
    (select count(*) from intervals where up),
    round(100.0 * (select count(*) from intervals where up) / nullif((select count(*) from intervals), 0), 3),
    (select count(*) from base),
    (select count(*) from base where data_quality_flag is not null),
    round(100.0 * (select count(*) from base where data_quality_flag is null) / nullif((select count(*) from base), 0), 3),
    (select min(timestamp) from base),
    (select max(timestamp) from base);
$$;

create or replace function get_files()
returns table (filename text) language sql stable as $$
  select distinct filename from health_checks where filename is not null order by filename;
$$;
