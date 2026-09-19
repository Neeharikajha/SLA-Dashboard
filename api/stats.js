import { client } from "../lib/db.js";

export default async function handler(req, res) {
  try {
    const [overall, services] = await Promise.all([
      client().rpc("overall_stats"),
      client().rpc("service_stats"),
    ]);

    if (overall.error || services.error) {
      throw new Error((overall.error || services.error).message);
    }

    const stats = overall.data?.[0] || {};
    stats.services = services.data || [];

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
