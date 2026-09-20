import { client } from "../lib/db.js";

function nextDay(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const { filename } = req.query;
  const filter_filename = filename || null;

  let overall, services;
  
  // Try calling the updated RPCs with filter_filename
  [overall, services] = await Promise.all([
    client().rpc("overall_stats", { filter_filename }),
    client().rpc("service_stats", { filter_filename }),
  ]);
  
  // Fallback for users who haven't run the updated schema.sql
  if (overall.error || services.error) {
    console.warn("RPC failed with filter_filename, falling back to old RPCs. Error:", overall.error?.message || services.error?.message);
    [overall, services] = await Promise.all([
      client().rpc("overall_stats"),
      client().rpc("service_stats"),
    ]);
  }

  if (overall.error || services.error) {
    return res
      .status(500)
      .json({ error: (overall.error || services.error).message });
  }

  res.status(200).json({ overall: overall.data[0], services: services.data });
}
