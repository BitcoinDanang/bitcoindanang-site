// Cloudflare Pages Function: proxy BTC/VND from BitcoinVN.io.
//
// We hold the API key as a Pages env var (BITCOINVN_API_KEY) so it
// never ships to the browser. The client calls /api/btc-vnd same-origin.
//
// Response shape:
//   { rate: <number>, volume24h: <number>, source: "bitcoinvn", at: <ISO> }
//
// Cached at the edge for 60s so we don't hammer BitcoinVN on every pageview.
export async function onRequestGet({ env }) {
  const key = env.BITCOINVN_API_KEY;
  if (!key) {
    return json({ error: "BITCOINVN_API_KEY not configured" }, 500);
  }
  try {
    const res = await fetch("https://bitcoinvn.io/api/ticker/BTC/VND", {
      headers: {
        "X-API-Key": key,
        Accept: "application/json",
        "User-Agent": "bitcoindanang.com/1.0",
      },
      cf: { cacheTtl: 60, cacheEverything: true },
    });
    if (!res.ok) {
      const body = await res.text();
      return json({ error: "upstream " + res.status, body: body.slice(0, 200) }, 502);
    }
    const data = await res.json();
    return json({
      rate: data.rate,
      volume24h: data.volume24h,
      source: "bitcoinvn",
      at: new Date().toISOString(),
    }, 200, {
      // Tell the browser + CF cache: 60s fresh, 5min stale-while-revalidate.
      "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
    });
  } catch (e) {
    return json({ error: "fetch failed", detail: String(e) }, 502);
  }
}

function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      ...extraHeaders,
    },
  });
}
