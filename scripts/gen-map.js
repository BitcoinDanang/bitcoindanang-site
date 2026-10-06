#!/usr/bin/env node
/**
 * Generate a self-hosted static map image for an event venue.
 *
 *   node scripts/gen-map.js <lat> <lon> <outname> [zoom]
 *   e.g. node scripts/gen-map.js 16.1051885 108.2622355 map-movie-night-2026
 *
 * Why this exists: every free third-party map (Google iframe, OSM embed,
 * Wikimedia static) blocks embedding/hotlinking or rate-limits at RUNTIME, so
 * they break for real visitors. This fetches the map image ONCE at build time
 * and saves it under public/images/, so the site serves it from its OWN domain.
 * A same-origin image can never be framed-out, referrer-blocked or rate-limited.
 * The .meetup-map__pin overlay marks the centre (the venue coordinates).
 *
 * Source: Wikimedia Maps (OSM data). One request per event, spaced out, with
 * backoff on rate-limit (HTTP 429/403). That is fine for occasional use; do not
 * loop this over many venues at once.
 */
const fs = require("fs"), path = require("path");

const [, , latS, lonS, outName, zoomS] = process.argv;
if (!latS || !lonS || !outName) {
  console.error("usage: node scripts/gen-map.js <lat> <lon> <outname> [zoom]");
  process.exit(1);
}
const z = parseInt(zoomS || "16", 10);
const url = `https://maps.wikimedia.org/img/osm-intl,${z},${latS},${lonS},640x360@2x.png`;
const OUT = path.resolve(__dirname, "..", "public", "images", outName + ".png");
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  for (let attempt = 1; attempt <= 6; attempt++) {
    const r = await fetch(url); // server-side: no Referer -> served
    if (r.ok) {
      const buf = Buffer.from(await r.arrayBuffer());
      fs.mkdirSync(path.dirname(OUT), { recursive: true });
      fs.writeFileSync(OUT, buf);
      console.log("wrote", OUT, Math.round(buf.length / 1024) + "KB");
      return;
    }
    console.log(`attempt ${attempt}: HTTP ${r.status} (rate-limited), backing off...`);
    await delay(60000);
  }
  console.error("FAILED: still rate-limited after retries. Try again in a few minutes.");
  process.exit(1);
})();
