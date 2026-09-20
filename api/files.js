import { client } from "../lib/db.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const { data, error } = await client().rpc("get_files");
  
  if (error) {
    // Graceful fallback if get_files RPC is missing
    console.warn("get_files RPC failed, falling back to empty list. Error:", error.message);
    return res.status(200).json({ files: [] });
  }

  const files = data.map(d => d.filename);
  res.status(200).json({ files });
}
