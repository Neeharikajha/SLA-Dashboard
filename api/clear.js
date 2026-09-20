import { client } from "../lib/db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    // Delete all rows where id is not null (which deletes everything)
    const { error } = await client()
      .from("health_checks")
      .delete()
      .not("id", "is", null);

    if (error) {
      throw error;
    }

    res.status(200).json({ success: true, msg: "Database cleared successfully." });
  } catch (err) {
    console.error("[clear] error:", err.message);
    res.status(500).json({ error: "Failed to clear database: " + err.message });
  }
}
