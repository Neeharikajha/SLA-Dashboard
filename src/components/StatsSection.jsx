import { useState, useEffect } from "react";
import TrendChart from "./TrendChart";

export default function StatsSection() {
  const [stats, setStats] = useState(null);
  const [latencies, setLatencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    Promise.all([fetch("/api/stats"), fetch("/api/latency")])
      .then(([s, l]) => {
        if (!s.ok || !l.ok) throw new Error("Failed to fetch");
        return Promise.all([s.json(), l.json()]);
      })
      .then(([statsData, latencyData]) => {
        setStats(statsData);
        setLatencies(latencyData.latencies || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="loading">Loading stats...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <section className="stats-section">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <h2>Statistics {expanded ? "▼" : "▶"}</h2>
      </div>

      {expanded && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="label">Uptime</div>
              <div className="value">
                {stats?.uptime_percent?.toFixed(2) ?? 0}%
              </div>
            </div>
            <div className="stat-card">
              <div className="label">Total Checks</div>
              <div className="value">
                {stats?.total_intervals?.toLocaleString() ?? 0}
              </div>
            </div>
            <div className="stat-card">
              <div className="label">Avg Latency</div>
              <div className="value">{stats?.avg_response_time ?? 0}ms</div>
            </div>
            <div className="stat-card">
              <div className="label">Data Quality</div>
              <div className="value">
                {stats?.data_quality_score?.toFixed(2) ?? 0}%
              </div>
            </div>
          </div>

          <h3 style={{ marginTop: "1.5rem", fontSize: "1rem" }}>
            Availability Trend
          </h3>
          <TrendChart />

          <h3 style={{ marginTop: "1.5rem", fontSize: "1rem" }}>
            Latency by Service (P50/P95/P99)
          </h3>
          <table className="logs-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>P50</th>
                <th>P95</th>
                <th>P99</th>
                <th>Avg</th>
              </tr>
            </thead>
            <tbody>
              {latencies.map((lat, i) => (
                <tr key={i}>
                  <td>{lat.service_name}</td>
                  <td>{lat.p50_ms}ms</td>
                  <td>{lat.p95_ms}ms</td>
                  <td>{lat.p99_ms}ms</td>
                  <td>{lat.avg_ms}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
