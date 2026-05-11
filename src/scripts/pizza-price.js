/**
 * Pizza Day live price feed.
 *
 * Primary source: our own /api/btc-vnd Cloudflare Pages Function, which
 * proxies BitcoinVN.io with the secret API key held server-side. Returns
 * { rate, volume24h, source, at }.
 *
 * Fallbacks (browser-direct, public APIs, no key):
 *   - CoinGecko simple/price (returns vnd directly)
 *   - CryptoCompare BTC/USD x open.er-api.com USD/VND
 *
 * Target DOM:
 *   #pizza-price-value     - main large gold price display
 *   #pizza-price-fallback  - shown if every source fails
 *
 * The element gets data-rate (BTC/VND single-coin) and data-source set
 * so the returns-table renderer below can substitute today's live price
 * into the 2026 (live) row.
 *
 * Emits 'pizza-price:loaded' with { rate, source } when it succeeds.
 */
(function () {
  var COINS = 10000;

  function formatVnd(n) {
    if (n == null || !isFinite(n)) return "";
    return Math.round(n).toLocaleString("vi-VN") + " ₫";
  }

  async function fetchJson(url, timeoutMs) {
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, timeoutMs || 8000);
    try {
      var res = await fetch(url, { headers: { Accept: "application/json" }, signal: ctrl.signal });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } finally {
      clearTimeout(t);
    }
  }

  async function tryBitcoinVN() {
    var j = await fetchJson("/api/btc-vnd");
    if (j && typeof j.rate === "number" && j.rate > 0) {
      return { rate: j.rate, source: "BitcoinVN", at: j.at };
    }
    throw new Error("no rate from /api/btc-vnd");
  }

  async function tryCoinGecko() {
    var j = await fetchJson(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=vnd"
    );
    var v = j && j.bitcoin && j.bitcoin.vnd;
    if (typeof v === "number" && v > 0) return { rate: v, source: "CoinGecko" };
    throw new Error("no rate from coingecko");
  }

  async function tryComposite() {
    var btcUsd = await fetchJson(
      "https://min-api.cryptocompare.com/data/price?fsym=BTC&tsyms=USD"
    );
    var u = btcUsd && btcUsd.USD;
    if (!u) throw new Error("no BTC/USD from cryptocompare");
    var fx = await fetchJson("https://open.er-api.com/v6/latest/USD");
    var v = fx && fx.rates && fx.rates.VND;
    if (!v) throw new Error("no USD/VND from er-api");
    return { rate: u * v, source: "CryptoCompare+er-api" };
  }

  async function getBtcVnd() {
    var tries = [tryBitcoinVN, tryCoinGecko, tryComposite];
    for (var i = 0; i < tries.length; i++) {
      try { return await tries[i](); }
      catch (e) { console.warn("[pizza-price] source", i, "failed:", e && e.message); }
    }
    return null;
  }

  async function render() {
    var valueEl = document.getElementById("pizza-price-value");
    var fallbackEl = document.getElementById("pizza-price-fallback");
    if (!valueEl) return;

    var hit = await getBtcVnd();
    if (!hit) {
      valueEl.textContent = "";
      if (fallbackEl) fallbackEl.hidden = false;
      return;
    }
    var total = hit.rate * COINS;
    valueEl.textContent = formatVnd(total);
    valueEl.setAttribute("data-rate", String(hit.rate));
    valueEl.setAttribute("data-source", hit.source);
    document.dispatchEvent(new CustomEvent("pizza-price:loaded", {
      detail: { rate: hit.rate, source: hit.source }
    }));
  }

  document.addEventListener("DOMContentLoaded", render);
})();
