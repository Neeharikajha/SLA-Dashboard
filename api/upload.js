import { cleanCsv } from "../lib/clean.js";
import { insertRows } from "../lib/db.js";

export const config = { api: { bodyParser: false } }; // we want the raw CSV text, not JSON

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "POST only" });

  let body = "";
  for await (const chunk of req) body += chunk;
  if (!body.trim())
    return res.status(400).json({ error: "Empty request body" });

  let rows, summary;
  try {
    ({ rows, summary } = cleanCsv(body));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  await insertRows(rows);
  res.status(200).json(summary);
}
