import { client } from "../lib/db.js";

export default async function handler(req, res) {
  try {
    const { data, error } = await client.rpc("service_latency_percentiles");

    if (error) throw error;

    res.json({ latencies: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
