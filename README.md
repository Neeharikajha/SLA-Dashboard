# SLA Monitoring Dashboard

Ingests CSV health-check logs, processes them via a serverless function, persists to a DB,
and shows a dashboard with SLA stats and a filterable log view.

**Live URL:** _added in Stage 5_

## Architecture

```
Upload UI (React) → Serverless function (parse/validate/clean) → Postgres → Dashboard UI
```

| Piece    | Choice                   | Why                                           |
| -------- | ------------------------ | --------------------------------------------- |
| Frontend | React + Vite             | minimal, fast                                 |
| Function | Vercel serverless (Node) | free, deploys from GitHub, real cloud runtime |
| DB       | Supabase Postgres        | real SQL, free tier, queryable after upload   |
| Hosting  | Vercel                   | one place for static + functions              |

Filled in as each stage lands (Stage 2 = function, Stage 3 = DB, Stage 4 = upload UI, Stage 5 = dashboard).

## Data findings

Ran `npm run analyze` over all 5 provided CSVs (`scripts/analyze.js`, no dependencies).
Full per-file output is in [`data-analysis.json`](./data-analysis.json). Every file has the
same 10 issues, at counts proportional to file size:

| #   | Issue                                                                           | Observed                                                | Handling (Stage 2)                                                         |
| --- | ------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1   | 3 timestamp formats in one column (`...Z`, `...+05:30`, 10-digit epoch seconds) | e.g. 30d file: 15235 iso_z / 109 iso_offset / 233 epoch | parse each by shape, convert to UTC, store as `Z`                          |
| 2   | Latency in 2 units (`latency_unit` = `ms` or `s`)                               | ~20% of rows are `s`                                    | multiply `s` values by 1000, store `latency_ms`                            |
| 3   | 1 negative latency per file                                                     | 1/file, e.g. `-223`                                     | drop row                                                                   |
| 4   | 1 invalid status code per file                                                  | `status_code=999`, 1/file                               | drop row (valid range 100–599)                                             |
| 5   | Missing latency, only on `status=200`                                           | 56–186 rows/file, scales with file size                 | keep row, `data_quality_flag='missing_latency'`                            |
| 6   | Exact duplicate rows (all columns identical)                                    | 6–24/file                                               | dedup on full row, keep first after sort                                   |
| 7   | Two agents, uneven coverage                                                     | agent-1 ~93–95%, agent-2 ~5–7%                          | keep both; unique key is `(service_id, timestamp, agent)`                  |
| 8   | Rows not in chronological order                                                 | every file                                              | sort by `(service_id, timestamp, agent)` before dedup                      |
| 9   | Scattered 30-min gaps (should be 15-min cadence)                                | 35–88/file                                              | exclude missing intervals from availability denominator, don't assume "up" |
| 10  | `region` is constant (`ap-south-1`)                                             | 100% of rows                                            | store as-is                                                                |

File sizes and true date ranges (the filenames' day-counts are accurate, but nothing was
assumed — they were derived from the data):

| File                              | Rows   | Days | Range (UTC)             |
| --------------------------------- | ------ | ---- | ----------------------- |
| monitoring_checks_9d_seed101.csv  | 4,672  | 9    | 2025-05-08 → 2025-05-16 |
| monitoring_checks_12d_seed505.csv | 6,230  | 12   | 2025-04-10 → 2025-04-21 |
| monitoring_checks_14d_seed202.csv | 7,269  | 14   | 2025-05-19 → 2025-06-01 |
| monitoring_checks_21d_seed303.csv | 10,904 | 21   | 2025-04-03 → 2025-04-23 |
| monitoring_checks_30d_seed404.csv | 15,577 | 30   | 2025-04-06 → 2025-05-05 |

All 5 services (`svc-auth`, `svc-payments`, `svc-reports`, `svc-search`, `svc-notify`)
appear in every file with roughly even row counts.

## Assumptions

- **Dedup key = all columns**, not `(service, timestamp)` — that would silently drop
  agent-2's readings whenever both agents hit the same interval.
- **Availability = 2xx/3xx checks ÷ total checks**, with missing/gapped intervals excluded
  from the denominator rather than counted as either up or down.
- **Multi-agent policy:** if any agent reports non-2xx for an interval, that interval counts
  as down — conservative, and it's the call an on-call engineer would default to.
- **Timestamps stored as `TIMESTAMPTZ`** (UTC), never a naive `TIMESTAMP`.
- No auth — out of scope per the assignment.

## Run locally

```bash
npm run analyze   # regenerates data-analysis.json from data/*.csv
```

## What I'd do differently with more time

- P50/P95/P99 latency, not just averages
- Real-time alerting when availability crosses a threshold
- CSV export of filtered logs
