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

  // Language can be pinned in the URL as a /en/ or /vi/ path prefix so a shared
  // link opens in the intended language regardless of the recipient's saved pref.
  function langFromPath() {
    const m = location.pathname.match(/^\/(en|vi)(?=\/|$)/);
    return m ? m[1] : null;
  }
  function stripLangPrefix(path) {
    return path.replace(/^\/(en|vi)(?=\/|$)/, '') || '/';
  }
  // Build the language-prefixed URL for the current page (switcher + sharing).
  function urlForLang(lang) {
    const rest = stripLangPrefix(location.pathname);
    const path = '/' + lang + (rest === '/' ? '/' : rest);
    return path + location.search + location.hash;
  }

  // Priority: URL prefix > saved preference > default.
  let currentLang = langFromPath() || localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG;

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
    const lang = btn.getAttribute('data-lang-btn');
    if (lang !== 'vi' && lang !== 'en') return;
    // Reflect the choice in the URL (path prefix) so copy/paste shares this language.
    try { history.pushState({ lang: lang }, '', urlForLang(lang)); } catch (_e) {}
    setLang(lang);
  });

  // Keep language in sync with back/forward navigation between /en/ and /vi/.
  window.addEventListener('popstate', function () {
    const lang = langFromPath();
    if (lang && lang !== currentLang) setLang(lang);
  });

  // Hamburger menu (mobile). The slide-in panel covers the hamburger button,
  // so we close on item click, outside-click, and Escape - otherwise users
  // get trapped behind the overlay after switching VI/EN.
  function closeNavMenu() {
    const links = document.querySelector('.nav__links');
    if (links) links.classList.remove('is-open');
  }
  document.addEventListener('click', function (e) {
    const links = document.querySelector('.nav__links');
    if (!links) return;
    if (e.target.closest('[data-nav-toggle]')) {
      e.preventDefault();
      links.classList.toggle('is-open');
      return;
    }
    if (e.target.closest('.nav__links a, .nav__links [data-lang-btn]')) {
      closeNavMenu();
      return;
    }
    if (links.classList.contains('is-open') && !e.target.closest('.nav__links')) {
      closeNavMenu();
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeNavMenu();
  });

  // Boot
  document.addEventListener('DOMContentLoaded', function () {
    setLang(currentLang);
  });

  // Expose
  window.i18n = { setLang: setLang, getLang: getLang };
  window.setLang = setLang;
})();
