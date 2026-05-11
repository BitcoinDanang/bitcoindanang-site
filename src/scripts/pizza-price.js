/**
 * Pizza Day live price feed - BitcoinVN ONLY.
 *
 * Hits our own Cloudflare Pages Function at /api/btc-vnd, which proxies
 * BitcoinVN.io's /api/ticker/BTC/VND with the secret X-API-Key held
 * server-side. Returns { rate, volume24h, source, at }.
 *
 * Target DOM:
 *   #pizza-price-value     - large numeric VND price (e.g. 20.996.930.009.772 ₫)
 *   #pizza-price-words     - words form below ("Approximately twenty trillion …")
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

  // ---- Number -> words helpers ----
  function viOnes(n) {
    return ["không","một","hai","ba","bốn","năm","sáu","bảy","tám","chín"][n];
  }
  function viUnder1000(n, withinCompound) {
    // 0..999 in Vietnamese. withinCompound = true means leading hundreds may be 0
    // (e.g. for 12 within "một nghìn lẻ mười hai" we don't want "không trăm").
    var hundreds = Math.floor(n / 100);
    var rest = n % 100;
    var tens = Math.floor(rest / 10);
    var units = rest % 10;
    var parts = [];
    if (hundreds > 0) parts.push(viOnes(hundreds) + " trăm");
    else if (withinCompound && rest > 0) parts.push("không trăm");
    if (tens > 1) {
      parts.push(viOnes(tens) + " mươi");
      if (units === 1) parts.push("mốt");
      else if (units === 5) parts.push("lăm");
      else if (units > 0) parts.push(viOnes(units));
    } else if (tens === 1) {
      parts.push("mười");
      if (units === 5) parts.push("lăm");
      else if (units > 0) parts.push(viOnes(units));
    } else if (units > 0) {
      if (hundreds > 0 || withinCompound) parts.push("lẻ");
      parts.push(viOnes(units));
    }
    return parts.join(" ");
  }
  function approxVNDWordsVI(amount) {
    // Round to nearest billion so the words form stays digestible.
    var roundedBillions = Math.round(amount / 1e9);
    var thousandBillions = Math.floor(roundedBillions / 1000); // nghìn tỷ
    var billionsRem = roundedBillions % 1000;                   // tỷ
    var out = "Khoảng ";
    if (thousandBillions > 0) out += viUnder1000(thousandBillions) + " nghìn tỷ";
    if (billionsRem > 0) {
      if (thousandBillions > 0) out += " ";
      out += viUnder1000(billionsRem, thousandBillions > 0) + " tỷ";
    }
    out += " đồng";
    return out;
  }

  function enUnder1000(n) {
    var ones = ["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
    var tens = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
    if (n < 20) return ones[n];
    if (n < 100) {
      var t = Math.floor(n / 10), u = n % 10;
      return tens[t] + (u > 0 ? "-" + ones[u] : "");
    }
    var h = Math.floor(n / 100), rest = n % 100;
    return ones[h] + " hundred" + (rest > 0 ? " " + enUnder1000(rest) : "");
  }
  function approxVNDWordsEN(amount) {
    var roundedBillions = Math.round(amount / 1e9);
    var trillions = Math.floor(roundedBillions / 1000);
    var billionsRem = roundedBillions % 1000;
    var out = "Approximately ";
    if (trillions > 0) out += enUnder1000(trillions) + " trillion";
    if (billionsRem > 0) {
      if (trillions > 0) out += " ";
      out += enUnder1000(billionsRem) + " billion";
    }
    out += " VND";
    return out;
  }

  function approxVNDWords(amount, lang) {
    return lang === "en" ? approxVNDWordsEN(amount) : approxVNDWordsVI(amount);
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

  function paintWords(amount) {
    var wordsEl = document.getElementById("pizza-price-words");
    if (!wordsEl) return;
    var lang = (window.i18n && window.i18n.getLang && window.i18n.getLang()) || "vi";
    wordsEl.textContent = approxVNDWords(amount, lang);
    wordsEl.setAttribute("data-amount", String(Math.round(amount)));
  }

  async function render() {
    var valueEl = document.getElementById("pizza-price-value");
    var fallbackEl = document.getElementById("pizza-price-fallback");
    if (!valueEl) return;

    // Show a low-key loading hint immediately so the box is never empty.
    if (!valueEl.textContent.trim()) valueEl.textContent = "…";

    try {
      var hit = await fetchBitcoinVN();
      var total = hit.rate * COINS;
      valueEl.textContent = formatVnd(total);
      valueEl.setAttribute("data-rate", String(hit.rate));
      valueEl.setAttribute("data-source", hit.source);
      paintWords(total);
      if (fallbackEl) fallbackEl.hidden = true;
      document.dispatchEvent(new CustomEvent("pizza-price:loaded", {
        detail: { rate: hit.rate, source: hit.source, total: total }
      }));
    } catch (err) {
      console.warn("[pizza-price] BitcoinVN fetch failed:", err && err.message);
      valueEl.textContent = "";
      var wordsEl = document.getElementById("pizza-price-words");
      if (wordsEl) wordsEl.textContent = "";
      if (fallbackEl) fallbackEl.hidden = false;
    }
  }

  // Re-paint the words form when the user toggles VI/EN.
  document.addEventListener("i18n:applied", function () {
    var wordsEl = document.getElementById("pizza-price-words");
    if (!wordsEl) return;
    var amt = parseFloat(wordsEl.getAttribute("data-amount") || "");
    if (isFinite(amt) && amt > 0) paintWords(amt);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();
