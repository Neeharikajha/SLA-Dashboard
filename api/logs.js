import { client } from "../lib/db.js";

export default async function handler(req, res) {
  try {
    const { data, error } = await client()
      .from("health_checks")
      .select(
        "timestamp, service_name, agent, status_code, latency_ms, data_quality_flag",
      )
      .order("timestamp", { ascending: false })
      .limit(500);

    if (error) throw error;

    res.json({ logs: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
