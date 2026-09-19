import { useEffect, useState } from "react";

const SERVICES = [
  "svc-auth",
  "svc-payments",
  "svc-reports",
  "svc-search",
  "svc-notify",
];
const LIMIT = 50;

export default function LogsTable({ refreshKey }) {
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    service_id: "",
    status: "",
    page: 1,
  });
  const [data, setData] = useState({ rows: [], total: 0 });

  useEffect(() => {
    const params = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v),
    );
    fetch(`/api/logs?${params}`)
      .then((r) => r.json())
      .then(setData);
  }, [filters, refreshKey]);

  const set = (key) => (e) =>
    setFilters((f) => ({ ...f, [key]: e.target.value, page: 1 }));
  const setPage = (page) => setFilters((f) => ({ ...f, page }));

  return (
    <section className="card">
      <h2>Logs</h2>
      <div className="filters">
        <label>
          From <input type="date" value={filters.from} onChange={set("from")} />
        </label>
        <label>
          To{" "}
          <input
            type="date"
            value={filters.to}
            onChange={set("to")}
            disabled={!filters.from}
          />
        </label>
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
