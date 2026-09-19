// Usage: node --env-file=.env.local scripts/roundtrip.js data/monitoring_checks_9d_seed101.csv
import fs from "fs";
import { cleanCsv } from "../lib/clean.js";
import { insertRows, countRows, sampleRows } from "../lib/db.js";

const file = process.argv[2] || "data/monitoring_checks_9d_seed101.csv";
const { rows, summary } = cleanCsv(fs.readFileSync(file, "utf8"));

console.log(`Cleaned ${file}: ${summary.valid_rows} valid rows, inserting...`);
await insertRows(rows);

console.log("Row count in DB:", await countRows());
console.log("Sample rows back from DB:", await sampleRows(3));
