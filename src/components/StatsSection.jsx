import { useEffect, useState } from "react";

const statusClass = (pct) =>
  pct >= 99.9 ? "green" : pct >= 99 ? "yellow" : "red";

export default function StatsSection({ refreshKey, filename }) {
  const [open, setOpen] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filename) params.set("filename", filename);
    fetch(`/api/stats?${params}`)
      .then((r) => r.json())
      .then(setStats);
  }, [refreshKey, filename]);

  const worstService = stats?.services?.reduce(
    (min, s) => (s.availability_pct < min.availability_pct ? s : min),
    stats.services[0]
  );

  return (
    <section className="card">
      {worstService && (
        <div style={{
          padding: '12px',
          marginBottom: '16px',
          borderRadius: '6px',
          background: worstService.availability_pct >= 99.9 ? '#e6f4ea' : worstService.availability_pct >= 99 ? '#fef7e0' : '#fce8e6',
          border: `1px solid ${worstService.availability_pct >= 99.9 ? '#1a7a3c' : worstService.availability_pct >= 99 ? '#a67c00' : '#b3261e'}`,
        }}>
          <strong style={{ marginRight: '8px' }}>System Status:</strong> 
          <span className={statusClass(worstService.availability_pct)}>
            {worstService.availability_pct >= 99.9 
              ? 'All services operational' 
              : `${worstService.service_name} needs attention (${worstService.availability_pct}% availability)`}
          </span>
        </div>
      )}
      <button className="toggle" onClick={() => setOpen((o) => !o)}>
        {open ? "▾" : "▸"} Stats
      </button>
      {open && stats?.overall && (
        <>
          <div className="stat-grid">
            <div
              className={`stat ${statusClass(stats.overall.availability_pct)}`}
            >
              <span className="stat-value">
                {stats.overall.availability_pct}%
              </span>
              <span className="stat-label">Availability</span>
            </div>
            <div className="stat">
              <span className="stat-value">{stats.overall.total_rows}</span>
              <span className="stat-label">Total checks</span>
            </div>
            <div className="stat">
              <span className="stat-value">{stats.overall.flagged_rows}</span>
              <span className="stat-label">Flagged rows</span>
            </div>
            <div className="stat">
              <span className="stat-value">
                {stats.overall.data_quality_score}%
              </span>
              <span className="stat-label">Data quality</span>
            </div>
          </div>
          <p className="range">
            {stats.overall.min_timestamp?.slice(0, 10)} →{" "}
            {stats.overall.max_timestamp?.slice(0, 10)}
          </p>
          <table>
            <thead>
              <tr>
                <th>Service</th>
                <th>Availability</th>
                <th>Avg latency</th>
                <th>Intervals</th>
              </tr>
            </thead>
            <tbody>
              {stats.services.map((s) => (
                <tr key={s.service_id}>
                  <td>{s.service_name}</td>
                  <td className={statusClass(s.availability_pct)}>
                    {s.availability_pct}%
                  </td>
                  <td>{s.avg_latency_ms ?? "—"} ms</td>
                  <td>{s.total_intervals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
