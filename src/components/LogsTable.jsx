import { useState, useEffect } from "react";

export default function LogsTable() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [serviceFilter, setServiceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetch("/api/logs")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((data) => {
        setLogs(data.logs || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const filtered = logs.filter((log) => {
    if (serviceFilter !== "all" && log.service_name !== serviceFilter)
      return false;
    if (statusFilter !== "all") {
      const code = parseInt(statusFilter);
      if (
        statusFilter === "2xx" &&
        (log.status_code < 200 || log.status_code >= 300)
      )
        return false;
      if (
        statusFilter === "4xx" &&
        (log.status_code < 400 || log.status_code >= 500)
      )
        return false;
      if (statusFilter === "5xx" && log.status_code < 500) return false;
    }
    return true;
  });

  const downloadCSV = () => {
    const headers = [
      "Time (UTC)",
      "Service",
      "Agent",
      "Status",
      "Latency (ms)",
      "Flag",
    ];
    const rows = filtered.map((log) => [
      new Date(log.timestamp).toISOString(),
      log.service_name,
      log.agent || "",
      log.status_code,
      log.latency_ms || "",
      log.data_quality_flag || "",
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((r) => r.map((v) => `"${v}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sla-logs-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="loading">Loading logs...</div>;
  if (error) return <div className="error">{error}</div>;

  const services = [...new Set(logs.map((l) => l.service_name))].sort();

  return (
    <section className="logs-section">
      <h2>Service Logs</h2>
      <div
        style={{
          display: "flex",
          gap: "1rem",
          marginBottom: "1rem",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <select
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
          style={{
            padding: "0.5rem",
            borderRadius: "4px",
            border: "1px solid #ccc",
          }}
        >
          <option value="all">All services</option>
          {services.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: "0.5rem",
            borderRadius: "4px",
            border: "1px solid #ccc",
          }}
        >
          <option value="all">All statuses</option>
          <option value="2xx">2xx (Success)</option>
          <option value="4xx">4xx (Client Error)</option>
          <option value="5xx">5xx (Server Error)</option>
        </select>

        <button
          onClick={downloadCSV}
          style={{
            padding: "0.5rem 1rem",
            background: "#4f46e5",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Export CSV
        </button>

        <span
          style={{ marginLeft: "auto", color: "#64748b", fontSize: "0.875rem" }}
        >
          Showing {filtered.length} of {logs.length} rows
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="loading">No logs match the filters.</p>
      ) : (
        <table className="logs-table">
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
            {filtered.map((log, i) => (
              <tr key={i}>
                <td>{new Date(log.timestamp).toLocaleString()}</td>
                <td>{log.service_name}</td>
                <td>{log.agent}</td>
                <td>
                  <span
                    className={`status-badge ${getStatusClass(log.status_code)}`}
                  >
                    {log.status_code}
                  </span>
                </td>
                <td>{log.latency_ms ? `${log.latency_ms}ms` : "—"}</td>
                <td>{log.data_quality_flag || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function getStatusClass(code) {
  if (code >= 200 && code < 300) return "success";
  if (code >= 400 && code < 500) return "warning";
  return "error";
}
