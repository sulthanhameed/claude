#!/usr/bin/env node
/**
 * Checks the live Supabase project against what the frontend expects.
 *
 *   node scripts/db-check.mjs          (npm run db:check)
 *
 * Answers the only question that matters when the site loads with an empty
 * menu: is the data missing, or is the frontend pointed somewhere else?
 *
 * It reads `frontend/.env` (the same file Vite reads), then:
 *
 *   1. decodes the key and reports its role and project ref — a `service_role`
 *      key or a key from a different project both look fine until you check;
 *   2. compares the ref inside the key to the ref in the URL;
 *   3. asks PostgREST for each table the site needs, and reports the row count,
 *      or the reason it could not;
 *   4. prints one verdict and the single next action.
 *
 * Exit code 0 = the database is ready, 1 = it needs something.
 *
 * No dependencies: plain fetch against the REST API.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// KHANG_ENV_FILE lets the test harness point at a fixture instead of the real
// frontend/.env; normal use needs no environment at all.
const envPath = process.env.KHANG_ENV_FILE || join(root, "frontend", ".env");

const die = (msg) => {
  console.error(msg);
  process.exit(1);
};

/* ── 1 · read the env the frontend actually builds with ─────────────────── */

if (!existsSync(envPath)) {
  die(
    `No frontend/.env found.\n\n` +
      `Create it from the template:\n` +
      `  cp frontend/.env.example frontend/.env\n\n` +
      `then fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.`,
  );
}

function readEnv(path) {
  const env = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const env = readEnv(envPath);
const url = (env.VITE_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
const key = (env.VITE_SUPABASE_ANON_KEY ?? "").trim();

const problems = [];
const notes = [];

if (!url) problems.push("VITE_SUPABASE_URL is empty in frontend/.env");
if (!key) {
  problems.push("VITE_SUPABASE_ANON_KEY is empty in frontend/.env");
}
if (problems.length) {
  console.error("\n  Cannot check anything yet:\n");
  for (const p of problems) console.error(`    · ${p}`);
  console.error(
    `\n  The frontend stays on the local mock while either value is empty,\n` +
      `  so the live menu has never been fetched.\n`,
  );
  process.exit(1);
}

/* ── 2 · decode the key ─────────────────────────────────────────────────── */

/** { role, ref } for a JWT anon key; null for the newer publishable keys. */
function decodeKey(k) {
  const parts = k.split(".");
  if (parts.length !== 3) return null; // sb_publishable_… is not a JWT
  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(payload, "base64").toString("utf8");
    const data = JSON.parse(json);
    return { role: data.role, ref: data.ref, exp: data.exp };
  } catch {
    return null;
  }
}

const decoded = decodeKey(key);
const urlRef = (url.match(/^https?:\/\/([a-z0-9]+)\.supabase\.co$/) ?? [])[1] ?? null;

console.log("\n  KHANG · Supabase check\n");
console.log(`  URL   ${url}`);
console.log(`  ref   ${urlRef ?? "(custom domain — ref not in the URL)"}`);

if (!urlRef) {
  // A custom domain is legitimate, so this is only a note. It does mean the
  // key/URL ref comparison below cannot run.
  notes.push("URL is not https://<ref>.supabase.co, so the ref inside the key cannot be cross-checked.");
}

if (decoded) {
  console.log(`  key   role=${decoded.role ?? "?"} ref=${decoded.ref ?? "?"}`);
  if (decoded.role === "service_role") {
    problems.push(
      "The key is the service_role master key. It bypasses every row level\n" +
        "    security policy and must never be used in a browser. Replace it with\n" +
        "    the anon / publishable key and rotate the service_role key in the\n" +
        "    dashboard — it has now been exposed.",
    );
  } else if (decoded.role !== "anon") {
    notes.push(`Key role is "${decoded.role}", not "anon" — check it is the right key.`);
  }
  if (decoded.ref && urlRef && decoded.ref !== urlRef) {
    problems.push(
      `The key belongs to project ${decoded.ref} but the URL points at ${urlRef}.\n` +
        `    The frontend will get 401 Invalid API key from every request.`,
    );
  }
  if (decoded.exp && decoded.exp * 1000 < Date.now()) {
    problems.push("The key has expired (exp is in the past).");
  }
} else {
  console.log("  key   not a JWT — assuming a publishable key");
}

/* ── 3 · ask PostgREST about each table ─────────────────────────────────── */

const TABLES = [
  ["products", "17 dishes"],
  ["categories", "5 categories"],
  ["reviews", "4 house reviews"],
  ["orders", "customer orders"],
  ["profiles", "customer accounts"],
];

async function probe(table) {
  const endpoint = `${url}/rest/v1/${table}?select=id&limit=1`;
  let res;
  try {
    res = await fetch(endpoint, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        // ask PostgREST for the real row count in Content-Range
        Prefer: "count=exact",
      },
    });
  } catch (err) {
    return { state: "network", detail: err?.cause?.code || err?.message || "fetch failed" };
  }

  const body = await res.text();
  let parsed = null;
  try {
    parsed = JSON.parse(body);
  } catch {
    /* PostgREST can answer with plain text on some failures */
  }

  if (res.status === 401 || res.status === 403) {
    return {
      state: "auth",
      detail: parsed?.message || body.slice(0, 120) || `HTTP ${res.status}`,
    };
  }
  if (res.status === 404) {
    const code = parsed?.code;
    return {
      state: code === "42P01" ? "missing" : "error",
      detail: parsed?.message || body.slice(0, 120),
    };
  }
  if (!res.ok) {
    return { state: "error", detail: parsed?.message || `HTTP ${res.status}` };
  }

  // `Content-Range: 0-0/17` or `*/0` when empty
  const range = res.headers.get("content-range") ?? "";
  const total = Number(range.split("/")[1]);
  if (Number.isFinite(total)) return { state: "ok", count: total };
  if (Array.isArray(parsed)) return { state: "ok", count: parsed.length, approx: true };
  return { state: "ok", count: null };
}

/* A service_role key or a ref mismatch is a certain failure — every request
   will be rejected. Probing anyway would bury the real cause under five
   identical "could not reach" lines, so stop here and report the fix. */
const blockers = problems.length > 0;

const results = {};
if (blockers) {
  console.log("\n  tables\n");
  console.log("  skipped — fix the problem above first, every request would fail");
}
for (const [table, what] of (blockers ? [] : TABLES)) {
  const r = await probe(table);
  results[table] = r;

  const label = `  ${table.padEnd(12)}${what.padEnd(20)}`;
  if (r.state === "ok") {
    const n = r.count === null ? "?" : r.count;
    const flag = r.count === 0 ? "·" : "✓";
    console.log(`${label}${flag} ${n} rows${r.approx ? " (approx)" : ""}`);
  } else if (r.state === "missing") {
    console.log(`${label}✗ table does not exist`);
  } else if (r.state === "auth") {
    console.log(`${label}✗ rejected the key — ${r.detail}`);
  } else if (r.state === "network") {
    console.log(`${label}✗ could not reach the project — ${r.detail}`);
  } else {
    console.log(`${label}✗ ${r.detail}`);
  }
}

/* ── 4 · verdict ────────────────────────────────────────────────────────── */

const any = (state) => Object.values(results).some((r) => r.state === state);
const products = results.products;

if (any("network")) {
  problems.push(
    "Could not reach the project at all. Either the URL is wrong, the project is\n" +
      "    paused (Free plan pauses after inactivity — restore it in the dashboard),\n" +
      "    or this machine has no connection.",
  );
} else if (any("auth")) {
  problems.push(
    "Supabase rejected the key. Copy the anon / publishable key again from\n" +
      "    Project Settings → API Keys for THIS project.",
  );
} else if (any("missing")) {
  problems.push(
    "The tables do not exist yet. Run supabase/setup.sql in the SQL Editor\n" +
      "    (dashboard → SQL Editor → New query → paste → Run).",
  );
} else if (products && products.state === "ok" && products.count === 0) {
  problems.push(
    "The tables exist but products is empty, which is exactly what the site\n" +
      '    shows as "The menu is empty". Run supabase/seed-only.sql — it fills\n' +
      "    the 5 categories, 17 dishes and 4 reviews and touches nothing else.",
  );
} else if (products && products.state === "ok" && products.count > 0) {
  const p = products.count;
  if (p !== 17) {
    notes.push(`products has ${p} rows; the seed ships 17. Some dishes were added or removed.`);
  }
}

if (problems.length) {
  console.log("\n  verdict: needs action\n");
  for (const problem of problems) {
    const [first, ...rest] = problem.split("\n");
    console.log(`    · ${first}`);
    for (const line of rest) console.log(`      ${line.trim()}`);
  }
} else {
  console.log("\n  verdict: ready ✓\n");
  if (products?.count) console.log(`    ${products.count} dishes are readable by the anon key.`);
  console.log("    The site should show the live menu after a hard refresh (Ctrl+Shift+R).");
}

if (notes.length) {
  console.log("\n  notes\n");
  for (const n of notes) console.log(`    · ${n}`);
}
console.log("");

process.exit(problems.length ? 1 : 0);
