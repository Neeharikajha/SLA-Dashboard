# SLA Monitoring Dashboard

A full-stack monitoring platform that ingests CSV health-check logs, processes them in the cloud, persists cleaned data, and displays SLA metrics and logs on a live dashboard.

**Live URL:** https://sla-dashboard-delta.vercel.app/

---

## Overview

This application addresses the core problem: **cloud providers need a trustworthy pipeline to turn raw monitoring logs into SLA numbers.** The system processes multi-day, multi-agent health-check data with inherent quality issues (mixed formats, duplicates, gaps) and surfaces actionable stats for on-call engineers and billing teams.

---

## Architecture

```
Upload UI (React)
    ↓ (CSV as raw text)
    ↓
Serverless Function (Vercel)
    ↓ (parse, validate, clean, dedup)
    ↓
Supabase Postgres Database
    ↓ (query)
    ↓
Dashboard UI (React)
```

### Component Choices

| Component                 | Technology                 | Reasoning                                                                                                      |
| ------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Frontend**              | React + Vite               | Fast refresh, minimal bundle, no dependencies needed                                                           |
| **Serverless Processing** | Vercel Functions (Node.js) | Real cloud runtime (not local), free tier, auto-deploys from GitHub, runs stateless—processes once and returns |
| **Database**              | Supabase (Postgres)        | Free tier, real SQL, re-queryable after upload, supports complex queries needed for multi-agent SLA logic      |
| **Hosting**               | Vercel                     | Single platform for frontend + functions, auto-redeploys on GitHub push, free tier sufficient for demo         |

### Data Flow

1. **Upload UI** — user picks a CSV file, frontend reads it as text, POSTs raw body to `/api/upload`
2. **Serverless Function** (`api/upload.js`) — runs in the cloud (Vercel), parses/validates/cleans/deduplicates, returns summary stats
3. **Persistence** — cleaned rows inserted to Supabase `health_checks` table via upsert (safe for re-uploads)
4. **Dashboard Queries** — `/api/stats` and `/api/logs` fetch from DB, apply filtering, return paginated results
5. **UI Rendering** — React components display stats (collapsible, color-coded by availability %) and filterable log table

---

## Data Findings

All 5 provided CSV files exhibit the same 10 quality issues (see `data-analysis.json` for full details):

| Issue                           | Example                                                                   | How Handled                                                                    |
| ------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **3 timestamp formats**         | `2025-05-08T10:30:00Z`, `2025-05-08T10:30:00+05:30`, `1714953000` (epoch) | Parse by shape, convert all to UTC ISO-8601, store as `TIMESTAMPTZ`            |
| **2 latency units**             | `latency_ms: 150` vs `latency_unit: 's'` → `150 s`                        | Normalize to milliseconds; multiply seconds by 1000                            |
| **Negative latencies**          | `-223 ms` (data error)                                                    | Drop row                                                                       |
| **Invalid status codes**        | `status_code: 999` (outside 100–599 range)                                | Drop row                                                                       |
| **Missing latencies**           | `latency: NULL` on 200 responses (~100 rows per file)                     | Keep row, flag `data_quality_flag='missing_latency'`                           |
| **Exact duplicate rows**        | All fields identical (~10 rows per file)                                  | Dedup on `(service_id, timestamp, agent, status_code, latency_ms)`; keep first |
| **Uneven multi-agent coverage** | Agent-1: 93%, Agent-2: 7%                                                 | Keep both; treat as independent reporters for same interval                    |
| **Unsorted rows**               | Rows not in `(service_id, timestamp, agent)` order                        | Sort before dedup to ensure consistency                                        |
| **30-min gaps**                 | Checks at 15-min intervals but some missing (should be ~96/day, get ~94)  | Exclude missing intervals from denominator—no row = interval not counted       |
| **Constant region**             | All rows `region='ap-south-1'`                                            | Store as-is; doesn't affect stats                                              |

**Data ranges:**

- 9d file: 4,672 rows, 2025-05-08 to 2025-05-16
- 12d file: 6,230 rows, 2025-04-10 to 2025-04-21
- 14d file: 7,269 rows, 2025-05-19 to 2025-06-01
- 21d file: 10,904 rows, 2025-04-03 to 2025-04-23
- 30d file: 15,577 rows, 2025-04-06 to 2025-05-05

All 5 services (`svc-auth`, `svc-payments`, `svc-reports`, `svc-search`, `svc-notify`) appear in every file.

---

## Assumptions & Design Decisions

### Availability Definition

**SLA availability = (2xx checks) ÷ (total checks reported)**, where:

- **2xx only** (not 2xx/3xx) — more conservative, standard in the industry
- **Multi-agent policy:** if any agent reports non-2xx for an interval → interval is DOWN
  - Rationale: on-call engineer default is "assume the worst"
- **Missing intervals excluded from denominator** — if no agent reported during a 15-min slot, it's not counted as down (it never happened)

### Stats Display (Dashboard Top Section)

**What's shown:**

- **Overall availability %** — entire data range, all services
- **Total checks** — raw row count (helps detect data gaps)
- **Flagged rows** — count of rows with quality issues (`missing_latency`, etc.)
- **Data quality score %** — `(valid_rows) ÷ (total_rows) × 100`
- **Per-service table** — availability %, avg latency, # of intervals per service

**Why these stats?** An on-call engineer needs:

1. A glance at system health (is 99.9% met?)
2. Confidence in the data itself (how much was dropped/flagged?)
3. Service-level breakdown (which service is dragging availability down?)

Colors: 🟢 ≥99.9% (green), 🟡 ≥99% (yellow), 🔴 <99% (red).

### Logs Section

- **Filters:** service, status (2xx vs non-2xx), latency sort (low→high or high→low)
- **Pagination:** 50 rows/page, shows "Page X of Y"
- **Download CSV** — export filtered results

### Deduplication Key

**All columns** (`service_id, timestamp, agent, status_code, latency_ms`), not just `(service, timestamp)`:

- Rationale: dropping agent-2's reading when agent-1 also hit that interval would hide real divergence in behavior
- The multi-agent policy enforces that both must be 2xx; showing both supports debugging

### Database Design

- **Table:** `health_checks` with unique constraint on `(service_id, timestamp, agent)`
- **Upsert, not insert** — if a user re-uploads the same CSV, it's a no-op (idempotent)
- **Supabase free tier auto-pauses** after 7 days idle; accessing the dashboard wakes it back up

### No Authentication

Out of scope per assignment. All users see the same data (shared, company-wide view).

---

## Setup & Deployment

### Local Development

1. **Create a Supabase project** (free tier, supabase.com):
   - SQL Editor → run `db/schema.sql` to create the `health_checks` table
   - Settings → API → copy **Project URL** and **service_role key**

2. **Set environment variables** in `.env.local`:

   ```
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_SERVICE_KEY=eyJ...
   ```

3. **Install & run locally:**

   ```bash
   npm install
   npm run dev              # Vite frontend on http://localhost:5173
   vercel dev               # (in another terminal) functions on http://localhost:3000
   ```

   - Frontend auto-proxies `/api` calls to the Vercel Functions server

4. **Test the pipeline:**
   ```bash
   npm run roundtrip -- data/monitoring_checks_9d_seed101.csv
   ```
   This cleans a real CSV, inserts it, and reads it back (verifies the whole stack works).

### Deploy to Production

1. **Connect GitHub repo to Vercel:**
   - Go to vercel.com → "Add New Project" → "Import Git Repository"
   - Select your repo

2. **Set environment variables in Vercel dashboard:**
   - Add `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` (same as `.env.local`)

3. **Deploy:**

   ```bash
   vercel deploy --prod
   ```

   Or: push to GitHub → Vercel auto-deploys on every commit.

4. **Live URL:** https://sla-dashboard-delta.vercel.app/

---

## File Structure

```
.
├── api/
│   ├── upload.js        # POST /api/upload (stateless function: parse, clean, insert)
│   ├── stats.js         # GET /api/stats (fetch overall + per-service SLA)
│   ├── logs.js          # GET /api/logs (fetch filtered log rows)
│   ├── files.js         # GET /api/files (list uploaded CSVs)
│   └── clear.js         # POST /api/clear (reset database)
├── lib/
│   ├── clean.js         # Parse, validate, sort, dedup, flag logic (pure function)
│   └── db.js            # Supabase upsert, batch queries
├── db/
│   └── schema.sql       # Postgres schema + functions for SLA computation
├── src/
│   ├── components/
│   │   ├── Upload.jsx   # File upload UI + progress
│   │   ├── Dashboard.jsx  # Main page layout
│   │   ├── StatsSection.jsx  # Collapsible stats + per-service table
│   │   └── LogsTable.jsx    # Filterable, paginated log view
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── data/
│   └── *.csv            # Provided monitoring data files
├── README.md
├── package.json
└── vercel.json          # Vercel config (auto-generated)
```

---

## What I'd Do Differently With More Time

1. **Latency percentiles (P50/P95/P99)** instead of just averages — more actionable for perf troubleshooting
2. **Real-time alerting** — webhook/email when availability crosses threshold (e.g., drops below 99.9%)
3. **User authentication** — per-user or per-team data isolation, audit logs
4. **Time-series visualization** — charts showing availability/latency trends over the date range
5. **Bulk CSV re-processing** — re-run cleaning logic on existing rows if algorithm improves
6. **Automated data reconciliation** — daily health check against source system to catch sync issues
7. **SLA credit calculator** — auto-compute billing credits based on the agreed-upon terms
8. **Admin panel** — manage services, adjust thresholds, define custom SLA policies per service

---

## Running Locally Again

```bash
# Regenerate data analysis (see data-analysis.json)
npm run analyze

# Test the cleaning logic in isolation
npm run test-clean -- data/monitoring_checks_30d_seed404.csv

# Clean a CSV, insert, and read back (full pipeline)
npm run roundtrip -- data/monitoring_checks_9d_seed101.csv

# Start frontend (Vite)
npm run dev

# In another terminal: start Vercel Functions
vercel dev
```

---

**Summary:** This is a production-ready SLA dashboard that handles real, messy multi-day monitoring data in a cloud-native architecture. The serverless function cleanses data on upload, Postgres stores it durably, and the React UI surfaces actionable metrics to engineering and billing teams. Everything deployed live and free.
