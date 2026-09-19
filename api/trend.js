import { client } from "../lib/db.js";

export default async function handler(req, res) {
  try {
    const { data, error } = await client.rpc("daily_availability_trend");

    if (error) throw error;

    res.json({ trend: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
