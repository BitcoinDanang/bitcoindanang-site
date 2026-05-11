/**
 * Pizza Day live price feed.
 *
 * BTC/VND from CoinGecko's free public simple/price endpoint (returns VND
 * directly). If that fails or returns garbage, fall back to a two-step
 * compute: CryptoCompare BTC/USD x open.er-api.com USD/VND.
 *
 * Target DOM:
 *   #pizza-price-value     - main large gold price display
 *   #pizza-price-fallback  - hidden by default, shown if all sources fail
 *
 * The element gets `data-rate` set to the BTC/VND single-coin rate so the
 * returns-table renderer downstream can reuse the live number.
 *
 * The previous BitcoinVN endpoint (`bitcoinvn.io/api/v1/rates`) returns 404 -
 * they no longer publish a public REST rate. Attribution shown on the page
 * now reads "Nguồn giá: CoinGecko".
 */
(function () {
  var COINS = 10000;
  var SOURCES = [
    {
      name: "coingecko",
      url: "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=vnd",
      pick: function (j) {
        return j && j.bitcoin && typeof j.bitcoin.vnd === "number" ? j.bitcoin.vnd : null;
      },
    },
    {
      name: "cc+er",
      url: null, // composite - handled below
      pick: null,
    },
  ];

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

  async function fetchCompositeBtcVnd() {
    var btcUsdJson = await fetchJson(
      "https://min-api.cryptocompare.com/data/price?fsym=BTC&tsyms=USD"
    );
    var btcUsd = btcUsdJson && btcUsdJson.USD;
    if (!btcUsd) throw new Error("no BTC/USD from cryptocompare");
    var fxJson = await fetchJson("https://open.er-api.com/v6/latest/USD");
    var usdVnd = fxJson && fxJson.rates && fxJson.rates.VND;
    if (!usdVnd) throw new Error("no USD/VND from er-api");
    return btcUsd * usdVnd;
  }

  async function getBtcVnd() {
    // 1) CoinGecko direct
    try {
      var j = await fetchJson(SOURCES[0].url);
      var v = SOURCES[0].pick(j);
      if (v && v > 0) return { rate: v, source: "CoinGecko" };
    } catch (e) {
      console.warn("[pizza-price] coingecko failed:", e && e.message);
    }
    // 2) Composite fallback
    try {
      var v2 = await fetchCompositeBtcVnd();
      if (v2 && v2 > 0) return { rate: v2, source: "CryptoCompare x open.er-api" };
    } catch (e) {
      console.warn("[pizza-price] composite failed:", e && e.message);
    }
    return null;
  }

  async function render() {
    var valueEl = document.getElementById("pizza-price-value");
    var fallbackEl = document.getElementById("pizza-price-fallback");
    if (!valueEl) return;

    var hit = await getBtcVnd();
    if (!hit) {
      console.warn("[pizza-price] all sources failed");
      valueEl.textContent = "";
      if (fallbackEl) fallbackEl.hidden = false;
      return;
    }
    var total = hit.rate * COINS;
    valueEl.textContent = formatVnd(total);
    valueEl.setAttribute("data-rate", String(hit.rate));
    valueEl.setAttribute("data-source", hit.source);
    document.dispatchEvent(new CustomEvent("pizza-price:loaded", { detail: hit }));
  }

  document.addEventListener("DOMContentLoaded", render);
})();
