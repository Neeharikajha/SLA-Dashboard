import { cleanCsv } from "../lib/clean.js";
import { insertRows } from "../lib/db.js";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  console.log(
    `[upload] ${req.method} request, content-type: ${req.headers["content-type"]}`,
  );

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  return new Promise((resolve) => {
    let body = "";

    req.on("data", (chunk) => {
      console.log(`[upload] received chunk: ${chunk.length} bytes`);
      body += chunk.toString();
    });

    req.on("end", async () => {
      console.log(`[upload] stream end, total: ${body.length} bytes`);

      if (!body.trim()) {
        console.log(`[upload] body is empty!`);
        res.status(400).json({ error: "Empty request body" });
        resolve();
        return;
      }

      let rows, summary;
      try {
        const { filename } = req.query;
        ({ rows, summary } = cleanCsv(body, filename));
        console.log(
          `[upload] cleaned ${rows.length} rows from ${body.split("\n").length - 1} lines`,
        );
      } catch (err) {
        console.log(`[upload] parse error:`, err.message);
        res.status(400).json({ error: err.message });
        resolve();
        return;
      }

      try {
        await insertRows(rows);
        console.log(`[upload] inserted ${rows.length} rows`);
        res.status(200).json(summary);
      } catch (err) {
        if (err.message?.includes("'filename' column")) {
          console.log(`[upload] DB schema outdated, retrying without filename...`);
          const fallbackRows = rows.map(({ filename, ...rest }) => rest);
          try {
            await insertRows(fallbackRows);
            console.log(`[upload] inserted ${fallbackRows.length} rows (fallback)`);
            summary.warning = "Database schema is outdated. Run schema.sql in Supabase to enable CSV filtering.";
            res.status(200).json(summary);
            return;
          } catch (e2) {
            err = e2;
          }
        }
        console.log(`[upload] insert error:`, err.message);
        res
          .status(500)
          .json({ error: "Database insert failed: " + err.message });
      }
      resolve();
    });

    req.on("error", (err) => {
      console.log(`[upload] request error:`, err.message);
      res.status(500).json({ error: "Request error" });
      resolve();
    });
  });
}
