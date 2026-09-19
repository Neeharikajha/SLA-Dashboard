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

| #   | Issue                                                                           | Observed                                                | Handling                                                            |
| --- | ------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | 3 timestamp formats in one column (`...Z`, `...+05:30`, 10-digit epoch seconds) | e.g. 30d file: 15235 iso_z / 109 iso_offset / 233 epoch | `lib/clean.js` parses each by shape, converts to UTC, stores as `Z` |
| 2   | Latency in 2 units (`latency_unit` = `ms` or `s`)                               | ~20% of rows are `s`                                    | multiply `s` values by 1000, store `latency_ms`                     |
| 3   | 1 negative latency per file                                                     | 1/file, e.g. `-223`                                     | drop row                                                            |
| 4   | 1 invalid status code per file                                                  | `status_code=999`, 1/file                               | drop row (valid range 100–599)                                      |
| 5   | Missing latency, only on `status=200`                                           | 56–186 rows/file, scales with file size                 | keep row, `data_quality_flag='missing_latency'`                     |
| 6   | Exact duplicate rows (all columns identical)                                    | 6–24/file (raw-line count; see note below)              | dedup on all fields, keep first after sort                          |
| 7   | Two agents, uneven coverage                                                     | agent-1 ~93–95%, agent-2 ~5–7%                          | keep both; unique key is `(service_id, timestamp, agent)`           |
| 8   | Rows not in chronological order                                                 | every file                                              | sort by `(service_id, timestamp, agent)` before dedup               |
| 9   | Scattered 30-min gaps (should be 15-min cadence)                                | 35–88/file                                              | excluded from availability denominator — handled in Stage 5         |
| 10  | `region` is constant (`ap-south-1`)                                             | 100% of rows                                            | stored as-is                                                        |

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

**Note on duplicate counts:** Stage 1's `exact_duplicate_rows` counts literal identical raw
lines. Stage 2's pipeline validates (drops invalid status/negative latency) _before_
deduping, per the documented order `parse → validate → sort → dedup → flag` — so its
`exact_duplicate` count can differ slightly (e.g. 7 vs Stage 1's rough 6) when a duplicate
pair includes a row that gets dropped for another reason first. Run
`npm run test-clean -- data/<file>.csv` to see the real per-file numbers.

## Stage 3: database & persistence

1. Create a free project at [supabase.com](https://supabase.com) (no card required).
2. Open **SQL Editor** → paste and run [`db/schema.sql`](./db/schema.sql). Creates
   `health_checks` with a `unique (service_id, timestamp, agent)` constraint — see below.
3. **Settings → API** → copy the **Project URL** and the **`service_role` key** (not the
   anon key — the upload function needs write access) into `.env.local`:
   ```
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_SERVICE_KEY=eyJ...
   ```
4. Round-trip test — cleans a real CSV, inserts it, reads it back:
   ```bash
   npm run roundtrip -- data/monitoring_checks_9d_seed101.csv
   ```
5. Set the same two env vars in the Vercel dashboard once the project is deployed there
   (Stage 4), so `api/upload.js` can reach the DB in production too.

**Why upsert, not plain insert:** `lib/db.js` upserts on `(service_id, timestamp, agent)`
with `ignoreDuplicates: true`. Re-running `npm run roundtrip` on the same file, or a user
re-uploading the same CSV from the Stage 4 UI, is a no-op instead of a duplicate-key error —
useful since the assignment doesn't rule out someone uploading the same file twice.

**Supabase free-tier auto-pause:** the project pauses after 7 days with no activity. If
`npm run roundtrip` or the deployed `/api/upload` times out on a request, it's probably
paused — open the Supabase dashboard once to wake it back up. An optional keep-warm cron
gets added in Stage 5.

`api/upload.js` is a Vercel serverless function: `POST` raw CSV text as the body, it runs
`lib/clean.js` (parse/validate/sort/dedup/flag) and inserts the cleaned rows into Supabase,
returning the same summary shape shown above.

- **`lib/clean.js`** — pure function, no I/O. Testable standalone:
  ```bash
  npm run test-clean -- data/monitoring_checks_30d_seed404.csv
  ```
- **`lib/db.js`** — batched upsert (200 rows/batch) into `health_checks`. See Stage 3 below
  for creating the Supabase project this connects to.
- **`api/upload.js`** accepts the CSV as a raw `POST` body (not multipart) to keep the
  function simple — the Stage 4 upload UI reads the file as text and posts it directly.
- Response is error **counts**, not raw bad rows, to stay well under Vercel's 4.5 MB limit.

## Stage 4: upload UI

React + Vite, scaffolded with `npm create vite@latest -- --template react` and merged into
this repo (frontend and `api/` functions deploy together as one Vercel project).

- `src/components/Upload.jsx` — a file input, reads the CSV as text client-side
  (`file.text()`) and `POST`s it straight to `/api/upload` as the raw body — same contract
  `api/upload.js` already expects from Stage 2. Shows the returned summary or error inline.
- Local dev: `npm run dev` serves only the frontend (Vite, hot reload). Run `vercel dev` in
  a second terminal to serve `/api/*` on `:3000` — `vite.config.js` proxies `/api` calls
  there, so `fetch("/api/upload")` works the same in dev as in production.

## Stage 5: dashboard

- **`api/stats.js`** calls two Postgres functions defined in `db/schema.sql`:
  `overall_stats()` and `service_stats()`. Both group rows into `(service_id, timestamp)`
  intervals first and mark an interval "up" only if **every** agent that reported it was
  2xx — the documented multi-agent policy, enforced in SQL rather than re-implemented in
  JS. Missing intervals (checks that never happened) are naturally excluded from the
  denominator, since there's no row for them.
- **`api/logs.js`** filters `health_checks` by a single date or a `from`/`to` range,
  `service_id`, and status (`success` = 2xx, `fail` = non-2xx), paginated 50 rows/page.
- **`src/components/StatsSection.jsx`** — collapsible, color-coded (green ≥99.9%,
  yellow ≥99%, red below), overall + per-service table.
- **`src/components/LogsTable.jsx`** — date/range/service/status filters, paginated table.
- **`src/components/Dashboard.jsx`** — single screen: Upload → Stats → Logs. Uploading
  bumps a `refreshKey` so Stats and Logs refetch without a page reload.

**Assumption — "success" = 2xx only** (not 2xx/3xx). The take-home's planning notes used
both definitions in different places; 2xx-only is the more conventional SLA definition,
and it's applied consistently in `service_stats()`, `overall_stats()`, and the logs filter.

### Deploy

```bash
vercel deploy            # or: connect the GitHub repo in the Vercel dashboard for auto-deploy
```

Set `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in the Vercel project's environment variables
(same two values as `.env.local`). No `vercel.json` needed — Vercel auto-detects Vite for
the build and serves everything under `api/` as serverless functions.

## Assumptions

- **Dedup key = all columns**, not `(service, timestamp)` — that would silently drop
  agent-2's readings whenever both agents hit the same interval.
- **Availability = 2xx checks ÷ total checks** (see the 2xx-only note in Stage 5 — the
  original planning notes used "2xx/3xx" in one place, this is the definition actually
  implemented), with missing/gapped intervals excluded from the denominator rather than
  counted as either up or down.
- **Multi-agent policy:** if any agent reports non-2xx for an interval, that interval counts
  as down — conservative, and it's the call an on-call engineer would default to.
- **Timestamps stored as `TIMESTAMPTZ`** (UTC), never a naive `TIMESTAMP`.
- No auth — out of scope per the assignment.

## Run locally

```bash
npm run analyze   # regenerates data-analysis.json from data/*.csv
npm run dev        # Vite frontend on :5173
vercel dev          # /api functions on :3000 (separate terminal)
```

## What I'd do differently with more time

- P50/P95/P99 latency, not just averages
- Real-time alerting when availability crosses a threshold
- CSV export of filtered logs

# SLA-Dashboard

## Deployment

1. Push to GitHub (done)
2. Connect repo to Vercel via dashboard
3. Set environment variables in Vercel:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
4. Deploy automatically on push

**Live URL:** https://sla-dashboard-neeharika.vercel.app (deploy after setting env vars)

**Last verified:** To be deployed and tested live

## Features implemented

- **Health banner:** Top-level status indicator (green/yellow/red) showing worst service
- **Availability trends:** Line chart showing uptime per service per day
- **Latency percentiles:** P50/P95/P99 instead of just averages (reveals tail latency)
- **CSV export:** Download filtered logs as CSV for billing disputes
- **Upload history:** See all uploads with success/error status and quality scores
- **Multi-agent handling:** Per-service stats correctly handle agent-1 and agent-2 coverage
- **Flexible stats layout:** Collapsible section with overall + per-service breakdowns

## Run locally

```bash
npm install
vercel dev
```

Then visit http://localhost:3000, upload a CSV, and the dashboard populates.

## SQL functions

Run `db/schema.sql` once in Supabase SQL editor:

- `overall_stats()` — total checks, uptime %, latency p50/p95/p99
- `service_stats()` — per-service breakdown with percentiles
- `daily_availability_trend()` — daily uptime per service (for charts)
- `service_latency_percentiles()` — p50/p95/p99 by service

## Assumptions

- **Uptime = 2xx+3xx responses ÷ total checks** (5xx is down, 4xx is client error)
- **Multi-agent policy:** service is down if _any_ agent reported non-2xx for an interval
- **Percentile latency:** computed on non-null latency_ms (missing latency excluded)
- **Dedup key = all fields including agent** (agent-1 and agent-2 are not collapsed)

## What I'd do differently

- Real-time websocket alerts when availability crosses SLA threshold
- Heatmap of hourly availability by service (more compact than daily trend)
- Drill-down to individual agent/region latency breakdown
- Automated SLA credit calculations and audit trail
