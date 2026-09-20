import { useEffect, useState } from "react";

const SERVICES = [
  "svc-auth",
  "svc-payments",
  "svc-reports",
  "svc-search",
  "svc-notify",
];
const LIMIT = 50;

export default function LogsTable({ refreshKey, filename }) {
  const [filters, setFilters] = useState({
    service_id: "",
    status: "",
    page: 1,
  });
  const [data, setData] = useState({ rows: [], total: 0 });

  useEffect(() => {
    const activeFilters = { ...filters };
    if (filename) activeFilters.filename = filename;
    const params = new URLSearchParams(
      Object.entries(activeFilters).filter(([, v]) => v),
    );
    fetch(`/api/logs?${params}`)
      .then((r) => r.json())
      .then(setData);
  }, [filters, filename, refreshKey]);

  const set = (key) => (e) =>
    setFilters((f) => ({ ...f, [key]: e.target.value, page: 1 }));
  const setPage = (page) => setFilters((f) => ({ ...f, page }));

  const downloadCsv = () => {
    if (!data.rows.length) return;
    const header = "Time (UTC),Service,Agent,Status,Latency,Flag\n";
    const csv = data.rows.map(r => 
      `${r.timestamp.replace("T", " ").slice(0, 19)},${r.service_name},${r.agent},${r.status_code},${r.latency_ms ?? ""},${r.data_quality_flag ?? ""}`
    ).join("\n");
    const blob = new Blob([header + csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  return (
    <section className="card">
      <h2>Logs</h2>
      <div className="filters">
        <select value={filters.service_id} onChange={set("service_id")}>
          <option value="">All services</option>
          {SERVICES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={filters.status} onChange={set("status")}>
          <option value="">All statuses</option>
          <option value="success">2xx</option>
          <option value="fail">Non-2xx</option>
        </select>
        <button className="btn" onClick={downloadCsv} disabled={!data.rows.length} style={{ marginLeft: 'auto' }}>
          Download CSV
        </button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Time (UTC)</th>
            <th>Service</th>
            <th>Agent</th>
            <th>Status</th>
            <th>Latency</th>
            <th>Flag</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r) => (
            <tr key={r.id}>
              <td>{r.timestamp.replace("T", " ").slice(0, 19)}</td>
              <td>{r.service_name}</td>
              <td>{r.agent}</td>
              <td className={r.status_code < 300 ? "green" : "red"}>
                {r.status_code}
              </td>
              <td>{r.latency_ms ?? "—"}</td>
              <td>{r.data_quality_flag ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pager">
        <button
          disabled={filters.page <= 1}
          onClick={() => setPage(filters.page - 1)}
        >
          Prev
        </button>
        <span>
          Page {filters.page} · {data.total} rows
        </span>
        <button
          disabled={filters.page * LIMIT >= data.total}
          onClick={() => setPage(filters.page + 1)}
        >
          Next
        </button>
      </div>
    </section>
  );
}
