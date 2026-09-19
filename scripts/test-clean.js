import fs from "fs";
import { cleanCsv } from "../lib/clean.js";

const file = process.argv[2] || "data/monitoring_checks_9d_seed101.csv";
const { summary } = cleanCsv(fs.readFileSync(file, "utf8"));
console.log(JSON.stringify(summary, null, 2));
