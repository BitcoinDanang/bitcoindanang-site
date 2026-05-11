/**
 * Pizza Day live price feed - BitcoinVN ONLY.
 *
 * Hits our own Cloudflare Pages Function at /api/btc-vnd, which proxies
 * BitcoinVN.io's /api/ticker/BTC/VND with the secret X-API-Key held
 * server-side. Returns { rate, volume24h, source, at }.
 *
 * Target DOM:
 *   #pizza-price-value     - main large gold price display
 *   #pizza-price-fallback  - shown only if the BitcoinVN proxy fails
 *
 * The element gets data-rate (BTC/VND single-coin) and data-source set
 * so the returns-table renderer below uses today's live price for the
 * 2026 (live) row.
 *
 * Emits 'pizza-price:loaded' with { rate, source } when it succeeds.
 */
(function () {
  var COINS = 10000;
  var ENDPOINT = "/api/btc-vnd";

  function formatVnd(n) {
    if (n == null || !isFinite(n)) return "";
    return Math.round(n).toLocaleString("vi-VN") + " ₫";
  }

  async function fetchBitcoinVN() {
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, 10000);
    try {
      var res = await fetch(ENDPOINT, {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      var j = await res.json();
      if (!j || typeof j.rate !== "number" || j.rate <= 0) {
        throw new Error("Bad payload: " + JSON.stringify(j).slice(0, 120));
      }
      return { rate: j.rate, volume24h: j.volume24h, source: "BitcoinVN", at: j.at };
    } finally {
      clearTimeout(t);
    }
  }

  async function render() {
    var valueEl = document.getElementById("pizza-price-value");
    var fallbackEl = document.getElementById("pizza-price-fallback");
    if (!valueEl) return;

    try {
      var hit = await fetchBitcoinVN();
      var total = hit.rate * COINS;
      valueEl.textContent = formatVnd(total);
      valueEl.setAttribute("data-rate", String(hit.rate));
      valueEl.setAttribute("data-source", hit.source);
      if (fallbackEl) fallbackEl.hidden = true;
      document.dispatchEvent(new CustomEvent("pizza-price:loaded", {
        detail: { rate: hit.rate, source: hit.source }
      }));
    } catch (err) {
      console.warn("[pizza-price] BitcoinVN fetch failed:", err && err.message);
      valueEl.textContent = "";
      if (fallbackEl) fallbackEl.hidden = false;
    }
  }

  // Run as soon as we can - the page can already render the rest while we
  // wait for the proxy. If DOMContentLoaded already fired (script late),
  // call directly.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();
