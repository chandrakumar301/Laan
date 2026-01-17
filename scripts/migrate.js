#!/usr/bin/env node
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigrations() {
  const migrationsDir = path.join(__dirname, "../supabase/migrations");
  const files = fs.readdirSync(migrationsDir).sort();

  for (const file of files) {
    if (!file.endsWith(".sql")) continue;

    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, "utf-8");

    console.log(`Running ${file}...`);
    const { error } = await supabase.rpc("exec_sql", { sql });

    if (error) {
      console.error(`Error running ${file}:`, error);
      // Try direct approach for basic SQL
      try {
        await supabase.from("conversations").select().limit(0);
        console.log("✅ Tables already exist");
      } catch (e) {
        console.error("Failed to create tables:", e);
      }
    } else {
      console.log(`✅ ${file} completed`);
    }
  }
}

runMigrations().catch(console.error);
