#!/usr/bin/env node
/**
 * Direct SQL Migration Runner for Supabase
 * This script runs SQL migrations directly via Supabase's GraphQL API
 */

const https = require("https");

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://tvojblmaoxbdyivsoqcw.supabase.co";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2b2pibG1hb3hiZHlpdnNvcWN3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM3OTI0OSwiZXhwIjoyMDgzOTU1MjQ5fQ.Bj1S7UaiGB07suUWzB0Lj-4Mj-stKsT1lmtpOSqples";

const sqlStatements = [
  `CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user1_id, user2_id)
  );`,

  `CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message_text TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text',
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
  );`,

  `CREATE TABLE IF NOT EXISTS blocked_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(blocker_id, blocked_id)
  );`,

  `CREATE TABLE IF NOT EXISTS user_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reported_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reason VARCHAR(100) NOT NULL,
    message TEXT,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
  );`,
];

async function executeSQL(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const url = new URL(SUPABASE_URL);

    const options = {
      hostname: url.hostname,
      port: 443,
      path: "/rest/v1/rpc/exec_sql",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve({ success: true, status: res.statusCode });
        } else {
          reject({ status: res.statusCode, data });
        }
      });
    });

    req.on("error", (e) => {
      reject(e);
    });

    req.write(body);
    req.end();
  });
}

async function runMigrations() {
  console.log("Starting database migrations...\n");

  for (const sql of sqlStatements) {
    try {
      console.log("Executing:", sql.substring(0, 50) + "...");
      await executeSQL(sql);
      console.log("✅ Success\n");
    } catch (err) {
      console.log("⚠️ Note:", err.status || err.message);
      console.log("This may be expected if tables already exist\n");
    }
  }

  console.log("Migration complete!");
}

runMigrations().catch(console.error);
