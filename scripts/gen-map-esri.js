#!/usr/bin/env node
/**
 * Static map fallback via Esri World_Street_Map export (reachable from Vietnam;
 * Wikimedia/OSM static tiles are rate-limited/blocked from VN - see memory
 * maps-leaflet-esri-vietnam). One request per venue.
 *
 *   node scripts/gen-map-esri.js <lat> <lon> <outname>
 */
const fs = require("fs"), path = require("path");
const [, , latS, lonS, outName] = process.argv;
if (!latS || !lonS || !outName) { console.error("usage: gen-map-esri.js <lat> <lon> <outname>"); process.exit(1); }
const lat = parseFloat(latS), lon = parseFloat(lonS);
const dLat = 0.00253, dLon = 0.0045; // ~zoom 16, 16:9 framing at this latitude
const bbox = [lon - dLon, lat - dLat, lon + dLon, lat + dLat].join(",");
const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/export?bbox=${bbox}&bboxSR=4326&imageSR=3857&size=640,360&format=png&transparent=false&f=image`;
const OUT = path.resolve(__dirname, "..", "public", "images", outName + ".png");
(async () => {
  const r = await fetch(url);
  if (!r.ok) { console.error("HTTP", r.status); process.exit(1); }
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(OUT, buf);
  console.log("wrote", OUT, buf.length, "bytes");
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
