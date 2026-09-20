import { client } from "../lib/db.js";

const LIMIT = 50;

function nextDay(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const { filename, service_id, status, page = "1" } = req.query;
  const offset = (Number(page) - 1) * LIMIT;

  let q = client()
    .from("health_checks")
    .select("*", { count: "exact" })
    .order("timestamp", { ascending: false });

  if (filename) {
    q = q.eq("filename", filename);
  }
  if (service_id) q = q.eq("service_id", service_id);
  if (status === "success")
    q = q.gte("status_code", 200).lt("status_code", 300);
  if (status === "fail") q = q.or("status_code.lt.200,status_code.gte.300");

  const { data, error, count } = await q.range(offset, offset + LIMIT - 1);
  if (error) return res.status(500).json({ error: error.message });

  res
    .status(200)
    .json({ rows: data, total: count, page: Number(page), limit: LIMIT });
}
