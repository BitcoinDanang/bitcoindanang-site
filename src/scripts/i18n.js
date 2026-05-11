/**
 * Bitcoin Đà Nẵng - bilingual (VI/EN) runtime translator.
 *
 * Usage: mark any element with `data-i18n="key.path"` and provide the matching
 * key in /src/i18n/vi.json + /src/i18n/en.json. For attributes use
 * `data-i18n-attr="placeholder"` (or comma-separated list).
 *
 * The language switcher in /src/components/nav.html calls window.setLang('vi'|'en').
 */
(function () {
  const STORAGE_KEY = 'lang';
  const DEFAULT_LANG = 'vi';

  const dictionaries = {};
  let currentLang = localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG;

  // Resolve path to /src/i18n/ regardless of whether the page lives in /src/pages/.
  function dictPath(lang) {
    // Always use the absolute /i18n/ path. In local dev (npx serve src) this
    // resolves to src/i18n/; on the deployed dist root it resolves to dist/i18n/.
    return '/i18n/' + lang + '.json';
  }

  async function loadDict(lang) {
    if (dictionaries[lang]) return dictionaries[lang];
    try {
      const res = await fetch(dictPath(lang), { cache: 'no-cache' });
      if (!res.ok) throw new Error('Failed to load ' + lang);
      dictionaries[lang] = await res.json();
      return dictionaries[lang];
    } catch (err) {
      console.warn('[i18n] could not load', lang, err);
      dictionaries[lang] = {};
      return dictionaries[lang];
    }
  }

  function lookup(dict, key) {
    return key.split('.').reduce(function (obj, k) {
      return (obj && obj[k] !== undefined) ? obj[k] : null;
    }, dict);
  }

  function applyDict(dict) {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      const key = el.getAttribute('data-i18n');
      const val = lookup(dict, key);
      if (val == null) return;
      const attrs = el.getAttribute('data-i18n-attr');
      if (attrs) {
        attrs.split(',').map(function (a) { return a.trim(); }).forEach(function (attr) {
          el.setAttribute(attr, val);
        });
      } else {
        el.innerHTML = val;
      }
    });
    document.documentElement.setAttribute('lang', currentLang);
    document.querySelectorAll('[data-lang-btn]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-lang-btn') === currentLang);
    });
    if (window.lucide) try { window.lucide.createIcons(); } catch (_e) {}
    document.dispatchEvent(new CustomEvent('i18n:applied', { detail: { lang: currentLang } }));
  }

  async function setLang(lang) {
    if (lang !== 'vi' && lang !== 'en') return;
    currentLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    const dict = await loadDict(lang);
    applyDict(dict);
  }

  function getLang() { return currentLang; }

  // Wire up language buttons (delegated, so partial loads after DOMContentLoaded work too).
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-lang-btn]');
    if (!btn) return;
    e.preventDefault();
    setLang(btn.getAttribute('data-lang-btn'));
  });

  // Hamburger menu (mobile)
  document.addEventListener('click', function (e) {
    const toggle = e.target.closest('[data-nav-toggle]');
    if (toggle) {
      e.preventDefault();
      const links = document.querySelector('.nav__links');
      if (links) links.classList.toggle('is-open');
      return;
    }
    // Close menu when a link inside it is clicked
    if (e.target.closest('.nav__links a')) {
      const links = document.querySelector('.nav__links');
      if (links) links.classList.remove('is-open');
    }
  });

  // Boot
  document.addEventListener('DOMContentLoaded', function () {
    setLang(currentLang);
  });

  // Expose
  window.i18n = { setLang: setLang, getLang: getLang };
  window.setLang = setLang;
})();
