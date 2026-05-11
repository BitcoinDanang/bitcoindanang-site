# CLAUDE.md — Bitcoin Đà Nẵng Site

Project memory for Claude Code working on this repo.

## Project Overview

- **What:** Static marketing + community website for the Bitcoin Đà Nẵng meetup.
- **Audience:** Vietnamese-first (VI primary, EN secondary). Mobile-first traffic, mostly from QR-code scans at events.
- **Stack:** Plain HTML/CSS/JS for Phases 1-5. TinaCMS for the blog (Phase 6). Deployed to Cloudflare Pages (Phase 7).
- **Bilingual:** All copy lives in `/src/i18n/vi.json` + `/src/i18n/en.json`, applied via `data-i18n="key"` attributes. Flag switcher top-right of every page. Default language: `vi`, persisted in `localStorage` under key `lang`.

## Repo Structure

```
/public/                static assets
  /images/              logo, flags, hero illustrations (placeholders only — user supplies)
  /data/                build-time JSON (e.g. pizza-day-history.json)
/src/
  /pages/               HTML pages (index, pizza-day-2026, bitcoin)
  /components/          reusable HTML partials (head, nav, footer)
  /styles/              tokens.css, base.css, components.css
  /scripts/             i18n.js, pizza-price.js
  /i18n/                vi.json, en.json
/content/
  /posts/               (Phase 6) TinaCMS markdown blog posts
  /events/              (Phase 6) event markdown
/tina/                  (Phase 6) TinaCMS config
/scripts/               (Phase 6) build.js
/.github/workflows/     (Phase 7) deploy.yml
CLAUDE.md               this file
README.md
.env.example            env var keys only — never commit real values
.gitignore
```

## Source Runbook & Docs

- **Primary spec:** `/Users/bowz/Downloads/bitcoindanang-runbook.md` — every section, line of copy (VI + EN), CSS token, and acceptance criterion comes from here. Always reread before making structural changes.
- **Obsidian vault:** `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/BitcoinDaNang/` — runbooks, blog drafts, content copy, image prompts, design briefs, partner notes. A parallel agent owns the vault; do **not** edit it from this repo's tooling.

## Cloudflare

- API token + account ID are stored in `/Users/bowz/.claude/projects/-Users-bowz/memory/bitcoindanang_project.md`. **Do not paste secrets into this file.**
- Domains on the same Cloudflare account: `bitcoindanang.com` (primary site) and `bitcoindanang.org` (email primary, also redirects to .com).
- CF Pages project name (Phase 7): `bitcoindanang`. Production branch: **`main`** (NOT `master`).

## GitHub

- Repo: `BitcoinDanang/bitcoindanang-site`
- `gh` CLI is already authenticated locally as the `BitcoinDanang` account.
- Remote is set (`origin`), but pushes are gated — confirm with the maintainer before pushing.

## Tina.io

- Already authorised against the `BitcoinDanang` GitHub account.
- Tina Cloud project will be wired up in Phase 6. Client ID + token live in `.env.local` (gitignored).

## Build / Run

- **Phases 1-5 (current):** No build step. Open `src/pages/*.html` directly, or `npx serve src` if you want a local server.
- **Phase 6 onward:** `npm run dev` (Tina + static serve), `npm run build` (Tina + `node scripts/build.js` → `dist/`).
- **Deploy:** `git push origin main` triggers the GitHub Actions workflow → CF Pages (after Phase 7 is set up).

## Brand Tokens

| Token | Value |
|---|---|
| `--color-gold` | `#D4AF37` |
| `--color-gold-light` | `#F5D87A` |
| `--color-gold-dark` | `#A07C1E` |
| `--color-black` | `#0D0D0D` |
| `--color-black-soft` | `#1A1A1A` |
| `--color-black-card` | `#222222` |
| `--color-white` | `#FAF7F0` (warm off-white) |
| `--color-white-muted` | `#E8E4DC` |
| `--color-text-on-dark` | `#F0EAD6` |
| `--color-text-muted` | `#9A9080` |
| `--font-display` | `'Cormorant Garamond', Georgia, serif` |
| `--font-body` | `'DM Sans', system-ui, sans-serif` |

- Body classes: `.theme-dark` (homepage) or `.theme-light` (education pages).

## Placeholders Left for the Maintainer

These strings appear verbatim in the source and will be replaced in Phase 9:

- `TELEGRAM_HANDLE_TBD` — Telegram group handle (e.g. `@BitcoinDaNang`).
- `/public/images/logo.png`, `/public/images/logo.svg` — logo files.
- `/public/images/flag-vn.svg`, `/public/images/flag-en.svg` — language switcher flags.
- `/public/images/hero-pizza-day.jpg`, `laszlo-illustration.jpg`, `bitcoin-vs-gold-hero.jpg`, `vietnamese-family-bitcoin.jpg`, `og-default.jpg` — generated illustrations (prompts in Phase 8 of the runbook, also in the Obsidian vault).
- `/public/data/pizza-day-history.json` — currently a placeholder array; the Phase 6 build script will fetch the real CoinGecko data.
- Wallet/QR for Pizza Day donations — placeholder, replace before May 22, 2026.

## Useful Don'ts

- Don't push to GitHub without explicit maintainer approval.
- Don't paste real secrets (CF token, Tina token) into the repo. `.env.example` keeps keys only.
- Don't touch the Obsidian vault from this repo.
- Don't install npm packages until Phase 6 — Phases 1-5 are pure static HTML/CSS/JS.
