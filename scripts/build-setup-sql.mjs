#!/usr/bin/env node
/**
 * Rebuilds `supabase/setup.sql` — the one-paste install for the SQL Editor.
 *
 * The four migrations plus the seed are the source of truth; this just stitches
 * them together in order with a banner before each one, so a fresh project can
 * be set up by pasting a single file into Supabase → SQL Editor.
 *
 *   npm run setup:sql        (node scripts/build-setup-sql.mjs)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const parts = [
  ["migrations/20261024090000_schema.sql", "1 · SCHEMA — tables, enums, indexes, triggers"],
  ["migrations/20261024090100_functions.sql", "2 · FUNCTIONS — pricing, orders, tracking, newsletter"],
  ["migrations/20261024090200_rls.sql", "3 · ROW LEVEL SECURITY"],
  ["migrations/20261024090300_order_reads.sql", "4 · ORDER READS — my_orders, get_my_order, admin list"],
  ["seed.sql", "5 · SEED — 5 categories, 17 dishes, 4 house reviews"],
];

const header = `-- ============================================================================
--  KHANG — one-paste database setup
--
--  Supabase Dashboard → SQL Editor → New query → paste this whole file → Run.
--
--  It is the four files in supabase/migrations/ in order, followed by
--  supabase/seed.sql, so a fresh project ends up with:
--
--    · 8 tables, 5 enums, indexes and triggers
--    · place_order / mark_order_paid / track_order / newsletter functions
--    · row level security on every table
--    · 5 categories, 17 dishes and 4 house reviews
--
--  Safe to run twice: tables use \`if not exists\`, functions \`or replace\`,
--  policies are dropped first, and the seed upserts on its natural keys.
--
--  Prefer the CLI? \`supabase link --project-ref <ref> && supabase db push\`
--  applies the migrations, and \`supabase db reset\` replays the seed locally.
--
--  This file is generated — the migrations remain the source of truth. After
--  editing them, rebuild it with:  npm run setup:sql
-- ============================================================================
`;

const bar = "=".repeat(76);
let out = header;

for (const [file, title] of parts) {
  const body = readFileSync(join(root, "supabase", file), "utf8").trimEnd();
  out += `\n-- ${bar}\n--  ${title}\n--  source: supabase/${file}\n-- ${bar}\n\n${body}\n`;
}

writeFileSync(join(root, "supabase", "setup.sql"), out);
const statements = out.split("\n").filter((l) => l.trim() && !l.trim().startsWith("--")).length;
console.log(`supabase/setup.sql written — ${out.split("\n").length} lines, ${statements} SQL lines`);
