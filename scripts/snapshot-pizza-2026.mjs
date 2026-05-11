#!/usr/bin/env node
// snapshot-pizza-2026.mjs
//
// Run on (or after) Pizza Day to lock the 2026 row in
// public/data/pizza-day-history.json with the day's BTC/VND close.
//
// Usage:
//   BITCOINVN_API_KEY=... node scripts/snapshot-pizza-2026.mjs
//   (with --force to overwrite an already-locked 2026 row)
//
// Designed to run from the GitHub Actions cron workflow on May 22 evening
// ICT. Also safe to run manually. Exits 0 if it wrote a change, 0 if no
// change needed (idempotent), non-zero if BitcoinVN fetch failed.
//
// The script:
//   1. Reads public/data/pizza-day-history.json
//   2. Finds the row with year == 2026
//   3. If live === true (or --force), fetches BTC/VND from BitcoinVN
//   4. Writes btc_vnd, locked_at, live=false. Leaves other rows alone.
//   5. Prints a one-line summary

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const JSON_PATH = path.join(ROOT, "public/data/pizza-day-history.json");

const FORCE = process.argv.includes("--force");
const KEY = process.env.BITCOINVN_API_KEY;
const ENDPOINT = "https://bitcoinvn.io/api/ticker/BTC/VND";

async function fetchRate() {
  if (!KEY) {
    throw new Error("BITCOINVN_API_KEY env var is not set");
  }
  const res = await fetch(ENDPOINT, {
    headers: {
      "X-API-Key": KEY,
      Accept: "application/json",
      "User-Agent": "bitcoindanang-site/snapshot-pizza-2026",
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`BitcoinVN ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  if (typeof data?.rate !== "number" || data.rate <= 0) {
    throw new Error(`BitcoinVN payload missing rate: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return { rate: data.rate, volume24h: data.volume24h ?? null };
}

async function main() {
  if (!fs.existsSync(JSON_PATH)) {
    console.error("[snapshot] no history JSON at", JSON_PATH);
    process.exit(1);
  }
  const raw = fs.readFileSync(JSON_PATH, "utf8");
  const data = JSON.parse(raw);
  const rates = data.rates || [];
  const row = rates.find((r) => r.year === 2026);
  if (!row) {
    console.error("[snapshot] no 2026 row in history JSON");
    process.exit(1);
  }
  if (!row.live && !FORCE) {
    console.log("[snapshot] 2026 row already locked; pass --force to overwrite.");
    process.exit(0);
  }

  const { rate, volume24h } = await fetchRate();
  row.btc_vnd = Math.round(rate);
  row.btc_usd = null; // we only have the BitcoinVN VND rate at snapshot time
  row.live = false;
  row.locked_at = new Date().toISOString();
  row.source = "bitcoinvn.io ticker/BTC/VND";
  row.volume24h = volume24h;

  fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(
    `[snapshot] locked 2026 row: BTC/VND = ${row.btc_vnd.toLocaleString("en-US")} ` +
      `(at ${row.locked_at})`
  );
}

main().catch((e) => {
  console.error("[snapshot] FAILED:", e?.message || e);
  process.exit(1);
});
