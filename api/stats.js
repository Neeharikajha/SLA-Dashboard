import { client } from "../lib/db.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const [overall, services] = await Promise.all([
    client().rpc("overall_stats"),
    client().rpc("service_stats"),
  ]);
  if (overall.error || services.error) {
    return res
      .status(500)
      .json({ error: (overall.error || services.error).message });
  }

  res.status(200).json({ overall: overall.data[0], services: services.data });
}
