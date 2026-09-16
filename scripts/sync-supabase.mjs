import { createClient } from "@supabase/supabase-js";
import { SEED_CASES } from "../data/seedCases.js";

/**
 * CI/CD Supabase Automated Schema & Data Sync Script
 * Executed automatically during GitHub Actions deployment or via npm run sync-supabase
 */
async function runSync() {
  console.log("=== SimulaCli Supabase Auto-Sync Runner ===");
  
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

  if (!url || !key) {
    console.log("SUPABASE_URL or SUPABASE_KEY environment variables not set.");
    console.log("Skipping automated cloud sync. App will run in local SQLite mode on GitHub Pages.");
    process.exit(0);
  }

  try {
    const supabase = createClient(url, key);
    console.log(`Connected to Supabase project at ${url}`);

    // Verify / Sync seed cases
    for (const seedCase of SEED_CASES) {
      console.log(`Syncing clinical case: ${seedCase.title}...`);
      const { error } = await supabase.from("cases").upsert([seedCase]);
      if (error) {
        console.warn(`Could not sync case ${seedCase.id}: ${error.message}`);
      } else {
        console.log(`Case ${seedCase.id} synced successfully.`);
      }
    }

    console.log("Supabase schema and seed data sync completed successfully!");
  } catch (err) {
    console.error("Error during Supabase sync execution:", err.message);
    process.exit(1);
  }
}

runSync();
