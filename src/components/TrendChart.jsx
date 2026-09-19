import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function TrendChart() {
  const [data, setData] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/trend")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((result) => {
        const trend = result.trend || [];

        // Transform flat array into nested structure by date
        const byDate = {};
        trend.forEach((row) => {
          if (!byDate[row.date]) byDate[row.date] = { date: row.date };
          byDate[row.date][row.service_name] = row.availability_pct;
        });

        const chartData = Object.values(byDate).sort(
          (a, b) => new Date(a.date) - new Date(b.date),
        );

        // Get unique service names
        const uniqueServices = [
          ...new Set(trend.map((r) => r.service_name)),
        ].sort();

        setData(chartData);
        setServices(uniqueServices);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading trend data...</div>;
  if (data.length === 0)
    return <div className="loading">No trend data available</div>;

  return (
    <div style={{ width: "100%", height: 300 }}>
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={(date) => new Date(date).toLocaleDateString()}
          />
          <YAxis
            domain={[0, 100]}
            label={{ value: "Uptime %", angle: -90, position: "insideLeft" }}
          />
          <Tooltip
            formatter={(val) => `${val?.toFixed(2)}%`}
            labelFormatter={(date) => new Date(date).toLocaleDateString()}
          />
          <Legend />
          {services.map((service, i) => (
            <Line
              key={service}
              type="monotone"
              dataKey={service}
              stroke={COLORS[i % COLORS.length]}
              dot={false}
              strokeWidth={2}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
