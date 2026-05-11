/**
 * Pizza Day live price feed - fetches the current BTC/VND rate from BitcoinVN.io
 * and renders `10,000 BTC × rate` formatted in Vietnamese number style.
 *
 * Target DOM:
 *   #pizza-price-value     - main large gold price display
 *   #pizza-price-fallback  - hidden by default, shown if the API fails
 *
 * The BitcoinVN public rates endpoint is `https://bitcoinvn.io/api/v1/rates`.
 * The exact JSON shape may shift; this script searches a few common field paths
 * before giving up. If the API consistently fails in production, swap in the
 * correct field name below and document it in Phase 9 of the runbook.
 */
(function () {
  const RATES_URL = 'https://bitcoinvn.io/api/v1/rates';
  const COINS = 10000;

  // Format a number using Vietnamese thousands separator (.) - e.g. 249.340.000.000.000
  function formatVnd(n) {
    if (n == null || !isFinite(n)) return '';
    const rounded = Math.round(n);
    return rounded.toLocaleString('vi-VN') + ' ₫';
  }

  // Look for a BTC/VND sell rate in a variety of plausible JSON shapes.
  function extractBtcVndRate(payload) {
    if (!payload) return null;

    // 1. Flat: { BTC_VND: 2493400000 } or { btc_vnd: ... }
    const flat = payload.BTC_VND || payload.btc_vnd || payload.BTCVND;
    if (typeof flat === 'number') return flat;
    if (typeof flat === 'string' && !isNaN(parseFloat(flat))) return parseFloat(flat);

    // 2. Nested: { BTC: { VND: { sell: ... } } } or { rates: { BTC: { VND: ... } } }
    const candidates = [
      payload?.BTC?.VND?.sell,
      payload?.BTC?.VND?.ask,
      payload?.BTC?.VND,
      payload?.rates?.BTC?.VND,
      payload?.rates?.BTC_VND,
      payload?.data?.BTC?.VND,
      payload?.data?.btc_vnd,
    ];
    for (const v of candidates) {
      if (typeof v === 'number') return v;
      if (typeof v === 'string' && !isNaN(parseFloat(v))) return parseFloat(v);
      if (v && typeof v === 'object') {
        const inner = v.sell || v.ask || v.value;
        if (typeof inner === 'number') return inner;
      }
    }

    // 3. Array of rate objects: [{ pair: 'BTC/VND', sell: ... }, ...]
    if (Array.isArray(payload)) {
      const hit = payload.find(function (r) {
        const p = (r && (r.pair || r.symbol || r.name) || '').toString().toUpperCase();
        return p.includes('BTC') && p.includes('VND');
      });
      if (hit) {
        const v = hit.sell || hit.ask || hit.rate || hit.price || hit.value;
        if (typeof v === 'number') return v;
        if (typeof v === 'string' && !isNaN(parseFloat(v))) return parseFloat(v);
      }
    }

    return null;
  }

  async function fetchPrice() {
    const valueEl = document.getElementById('pizza-price-value');
    const fallbackEl = document.getElementById('pizza-price-fallback');
    if (!valueEl) return;

    try {
      const res = await fetch(RATES_URL, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      const rate = extractBtcVndRate(json);
      if (!rate) throw new Error('Could not find BTC/VND rate in response');
      const total = rate * COINS;
      valueEl.textContent = formatVnd(total);
      valueEl.setAttribute('data-rate', String(rate));
    } catch (err) {
      console.warn('[pizza-price] live fetch failed:', err);
      valueEl.textContent = '';
      if (fallbackEl) fallbackEl.hidden = false;
    }
  }

  document.addEventListener('DOMContentLoaded', fetchPrice);
})();
