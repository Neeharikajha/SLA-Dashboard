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

-- Both functions implement the multi-agent policy: group rows into (service, timestamp)
-- intervals; an interval is "up" only if every agent that reported it was 2xx.

create or replace function service_stats()
returns table (
  service_id text, service_name text, total_intervals bigint, up_intervals bigint,
  availability_pct numeric, avg_latency_ms numeric
) language sql stable as $$
  with intervals as (
    select service_id, max(service_name) as service_name, timestamp,
      bool_and(status_code between 200 and 299) as up, avg(latency_ms) as latency_ms
    from health_checks group by service_id, timestamp
  )
  select service_id, max(service_name), count(*), count(*) filter (where up),
    round(100.0 * count(*) filter (where up) / count(*), 3),
    round(avg(latency_ms)::numeric, 1)
  from intervals group by service_id;
$$;

create or replace function overall_stats()
returns table (
  total_intervals bigint, up_intervals bigint, availability_pct numeric,
  total_rows bigint, flagged_rows bigint, data_quality_score numeric,
  min_timestamp timestamptz, max_timestamp timestamptz
) language sql stable as $$
  with intervals as (
    select service_id, timestamp, bool_and(status_code between 200 and 299) as up
    from health_checks group by service_id, timestamp
  )
  select count(*), count(*) filter (where up),
    round(100.0 * count(*) filter (where up) / nullif(count(*), 0), 3),
    (select count(*) from health_checks),
    (select count(*) from health_checks where data_quality_flag is not null),
    round(100.0 * (select count(*) from health_checks where data_quality_flag is null)
      / nullif((select count(*) from health_checks), 0), 3),
    (select min(timestamp) from health_checks),
    (select max(timestamp) from health_checks)
  from intervals;
$$;

-- Daily availability trend (for charts)
create or replace function daily_availability_trend()
returns table (
  date date, service_name text, availability_pct numeric
) language sql stable as $
  with daily_intervals as (
    select 
      date_trunc('day', timestamp)::date as date,
      service_id, max(service_name) as service_name, timestamp,
      bool_and(status_code between 200 and 299) as up
    from health_checks group by date, service_id, timestamp
  )
  select 
    date, service_name,
    round(100.0 * count(*) filter (where up) / count(*), 2)
  from daily_intervals
  group by date, service_name
  order by date, service_name;
$;

-- Percentile latency function
create or replace function service_latency_percentiles()
returns table (
  service_name text, p50_ms numeric, p95_ms numeric, p99_ms numeric, avg_ms numeric
) language sql stable as $
  select 
    service_name,
    round((percentile_cont(0.50) within group (order by latency_ms))::numeric, 1),
    round((percentile_cont(0.95) within group (order by latency_ms))::numeric, 1),
    round((percentile_cont(0.99) within group (order by latency_ms))::numeric, 1),
    round(avg(latency_ms)::numeric, 1)
  from health_checks
  where latency_ms is not null
  group by service_name;
$;
