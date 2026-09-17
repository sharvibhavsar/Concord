/**
 * fix-categories.mjs
 * Normalizes all task category values in Supabase to Title Case
 * so "work", "Work", "WORK" all become "Work".
 *
 * Run with:  node scripts/fix-categories.mjs
 */

import { readFileSync } from "fs";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

// ── 1. Load .env ────────────────────────────────────────────────────────────
const envPath = path.join(rootDir, ".env");
let envContent = "";
try {
  envContent = readFileSync(envPath, "utf-8");
} catch {
  console.error("❌ Could not read .env file at:", envPath);
  process.exit(1);
}

// Parse .env manually (handles lines like KEY=value)
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx < 0) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
  process.env[key] = value;
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not found in .env");
  process.exit(1);
}

// ── 2. Connect with pg ───────────────────────────────────────────────────────
const require = createRequire(import.meta.url);
let pg;
try {
  pg = require("pg");
} catch {
  console.error("❌ 'pg' package not found. Run: pnpm add pg -w");
  process.exit(1);
}

const { Pool } = pg;
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
});

// ── 3. Normalize categories ──────────────────────────────────────────────────
async function run() {
  const client = await pool.connect();
  try {
    // Show current distinct categories
    const { rows: before } = await client.query(
      `SELECT category, COUNT(*) as count
       FROM tasks
       GROUP BY category
       ORDER BY count DESC`
    );

    console.log("\n📋 Current categories in database:");
    for (const r of before) {
      console.log(`  "${r.category ?? "NULL"}" — ${r.count} task(s)`);
    }

    // Normalize: trim + lowercase first letter uppercase rest
    // e.g. "work" → "Work", "SHOPPING" → "Shopping", " Work " → "Work"
    const { rowCount } = await client.query(`
      UPDATE tasks
      SET category = INITCAP(LOWER(TRIM(category)))
      WHERE category IS NOT NULL
        AND TRIM(category) != INITCAP(LOWER(TRIM(category)))
    `);

    console.log(`\n✅ Normalized ${rowCount} task row(s).`);

    // Show after
    const { rows: after } = await client.query(
      `SELECT category, COUNT(*) as count
       FROM tasks
       GROUP BY category
       ORDER BY count DESC`
    );

    console.log("\n📋 Categories after normalization:");
    for (const r of after) {
      console.log(`  "${r.category ?? "NULL"}" — ${r.count} task(s)`);
    }

    console.log("\n🎉 Done! Refresh your browser to see the fixed radar chart.\n");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
