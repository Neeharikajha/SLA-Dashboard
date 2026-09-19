import { useState, useEffect } from "react";

export default function HealthBanner() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((data) => {
        setServices(data.services || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return null;

  const worstService = services.reduce((worst, curr) => {
    const currUptime = parseFloat(curr.uptime_percent) || 100;
    const worstUptime = parseFloat(worst.uptime_percent) || 100;
    return currUptime < worstUptime ? curr : worst;
  }, services[0] || {});

  const uptime = parseFloat(worstService.uptime_percent) || 100;
  let status = "ok";
  let color = "#10b981"; // green
  if (uptime < 99) {
    status = "warning";
    color = "#f59e0b"; // amber
  }
  if (uptime < 95) {
    status = "critical";
    color = "#ef4444"; // red
  }

  return (
    <div
      style={{
        background: color,
        color: "white",
        padding: "1rem 2rem",
        marginBottom: "1.5rem",
        borderRadius: "8px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div>
        <div style={{ fontSize: "0.875rem", opacity: 0.9 }}>
          System Status:{" "}
          <span style={{ textTransform: "uppercase", fontWeight: 600 }}>
            {status}
          </span>
        </div>
        <div style={{ fontSize: "1.125rem", marginTop: "0.25rem" }}>
          {worstService.service_name} · {uptime.toFixed(2)}% uptime
        </div>
      </div>
      <div style={{ fontSize: "2rem", fontWeight: 700 }}>
        {uptime.toFixed(1)}%
      </div>
    </div>
  );
}
