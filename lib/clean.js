// Parse -> validate -> sort -> dedup -> flag. Pure function, no I/O, so it can be
// unit-tested (see scripts/test-clean.js) without a deployed function or a DB.
// Hand-rolled split() is safe: this dataset has no quoted/comma-containing fields.

const EXPECTED_HEADER =
  "service_id,service_name,timestamp,status_code,latency,latency_unit,agent,region";

const parseTs = (v) =>
  /^\d{10}$/.test(v) ? new Date(Number(v) * 1000) : new Date(v); // Date() handles Z and +05:30 -> UTC
const tsFormat = (v) =>
  /^\d{10}$/.test(v) ? "epoch" : v.endsWith("Z") ? "iso_z" : "iso_offset";
const bump = (o, k) => (o[k] = (o[k] || 0) + 1);

export function cleanCsv(text, filename = null) {
  const lines = text.trim().split("\n");
  if (lines[0].trim() !== EXPECTED_HEADER) {
    throw new Error(`Unexpected CSV header: ${lines[0]}`);
  }
  const raw = lines.slice(1);

  const errors = {};
  const drop = (reason) => bump(errors, reason);
  const timestamp_formats_detected = {},
    latency_units = {},
    agents = {};
  const parsed = [];

  for (const line of raw) {
    const [
      service_id,
      service_name,
      timestamp,
      status_code,
      latency,
      latency_unit,
      agent,
      region,
    ] = line.trim().split(",");

    const sc = Number(status_code);
    if (sc < 100 || sc > 599) {
      drop("invalid_status_code");
      continue;
    }

    let latency_ms = null,
      data_quality_flag = null;
    if (latency === "") {
      if (sc === 200) data_quality_flag = "missing_latency";
    } else {
      const val = Number(latency);
      if (val < 0) {
        drop("negative_latency");
        continue;
      }
      latency_ms = Math.round(latency_unit === "s" ? val * 1000 : val);
    }

    bump(timestamp_formats_detected, tsFormat(timestamp));
    bump(latency_units, latency_unit);
    bump(agents, agent);

    parsed.push({
      service_id,
      service_name,
      timestamp: parseTs(timestamp).toISOString(),
      status_code: sc,
      latency_ms,
      agent,
      region,
      data_quality_flag,
      filename,
    });
  }

  // Sort so "first occurrence" during dedup is deterministic regardless of input order.
  parsed.sort(
    (a, b) =>
      a.service_id.localeCompare(b.service_id) ||
      a.timestamp.localeCompare(b.timestamp) ||
      a.agent.localeCompare(b.agent),
  );

  // Exact-dedup on all fields that came from the original row (agent included, so
  // agent-1 and agent-2 reporting the same interval are NOT collapsed into each other).
  const seen = new Set();
  const rows = [];
  for (const r of parsed) {
    const key = [
      r.service_id,
      r.service_name,
      r.timestamp,
      r.status_code,
      r.latency_ms,
      r.agent,
      r.region,
    ].join("|");
    if (seen.has(key)) {
      drop("exact_duplicate");
      continue;
    }
    seen.add(key);
    rows.push(r);
  }

  const dropped_rows = Object.values(errors).reduce((a, b) => a + b, 0);
  return {
    rows,
    summary: {
      original_rows: raw.length,
      valid_rows: rows.length,
      dropped_rows,
      errors_by_category: errors,
      data_quality_score: Number((rows.length / raw.length).toFixed(4)),
      timestamp_formats_detected,
      latency_units,
      agents,
    },
  };
}
