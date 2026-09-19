import { createClient } from "@supabase/supabase-js";

const BATCH_SIZE = 200;

// Lazy-init: importing this file shouldn't require env vars to already exist.
let supabase;
function client() {
  if (!supabase)
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
    );
  return supabase;
}

// Upsert on (service_id, timestamp, agent) so re-uploading the same CSV is a no-op,
// not a duplicate-key error.
export async function insertRows(rows) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const { error } = await client()
      .from("health_checks")
      .upsert(rows.slice(i, i + BATCH_SIZE), {
        onConflict: "service_id,timestamp,agent",
        ignoreDuplicates: true,
      });
    if (error) throw error;
  }
}

export async function countRows() {
  const { count, error } = await client()
    .from("health_checks")
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  return count;
}

export async function sampleRows(n = 5) {
  const { data, error } = await client()
    .from("health_checks")
    .select("*")
    .limit(n);
  if (error) throw error;
  return data;
}
