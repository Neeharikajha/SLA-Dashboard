// Stage 1: scans data/*.csv and writes data-analysis.json.
// No deps — CSVs here have no quoted/comma-containing fields, so a plain split is safe.
import fs from "fs";
import path from "path";

const DIR = "./data";
const parseTs = (v) =>
  /^\d{10}$/.test(v) ? new Date(Number(v) * 1000) : new Date(v);
const tsFormat = (v) =>
  /^\d{10}$/.test(v) ? "epoch" : v.endsWith("Z") ? "iso_z" : "iso_offset";
const bump = (obj, key) => (obj[key] = (obj[key] || 0) + 1);

function analyze(file) {
  const lines = fs
    .readFileSync(path.join(DIR, file), "utf8")
    .trim()
    .split("\n")
    .slice(1);
  const s = {
    file,
    total_rows: lines.length,
    timestamp_formats: {},
    services: {},
    agents: {},
    regions: {},
    latency_units: {},
    status_codes: {},
    invalid_status_code_rows: 0,
    negative_latency_rows: 0,
    missing_latency_on_200: 0,
    exact_duplicate_rows: 0,
  };
  const seen = new Map();
  let minTs, maxTs;

  for (const line of lines) {
    const cols = line.trim().split(",");
    const [
      service_id,
      ,
      timestamp,
      status_code,
      latency,
      latency_unit,
      agent,
      region,
    ] = cols;

    bump(s.timestamp_formats, tsFormat(timestamp));
    bump(s.services, service_id);
    bump(s.agents, agent);
    bump(s.regions, region);
    bump(s.latency_units, latency_unit);
    bump(s.status_codes, status_code);

    const sc = Number(status_code);
    if (sc < 100 || sc > 599) s.invalid_status_code_rows++;
    if (latency !== "" && Number(latency) < 0) s.negative_latency_rows++;
    if (latency === "" && sc === 200) s.missing_latency_on_200++;

    seen.set(line, (seen.get(line) || 0) + 1);

    const dt = parseTs(timestamp);
    if (!minTs || dt < minTs) minTs = dt;
    if (!maxTs || dt > maxTs) maxTs = dt;
  }

  for (const count of seen.values())
    if (count > 1) s.exact_duplicate_rows += count - 1;
  s.date_range = [minTs.toISOString(), maxTs.toISOString()];
  s.days_span = Math.floor((maxTs - minTs) / 86400000) + 1;
  return s;
}

const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".csv"));
const result = Object.fromEntries(files.map((f) => [f, analyze(f)]));
fs.writeFileSync("./data-analysis.json", JSON.stringify(result, null, 2));
console.log(`Analyzed ${files.length} files -> data-analysis.json`);
