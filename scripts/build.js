#!/usr/bin/env node
/**
 * Bitcoin Đà Nẵng static-site build script.
 *
 * Responsibilities:
 *   1. Wipe /dist and copy /src and /public into it (preserving structure).
 *   2. Read /content/posts/*.md, parse frontmatter, write
 *      /dist/data/posts.json (consumed by /scripts/blog.js at runtime).
 *   3. For every `published: true` post, render /dist/pages/blog/<slug>.html
 *      from /src/pages/blog-post.html by replacing {{title}}, {{date}},
 *      {{author}}, {{excerpt}}, {{body}} placeholders. Body markdown is
 *      converted to HTML with a minimal renderer (paragraphs, headings,
 *      bold, italic, links, lists) - enough for editorial blog content.
 *   4. Copy /admin (produced by `tinacms build`) into /dist/admin if present.
 *
 * Zero runtime dependencies - uses only the Node standard library so the
 * GitHub Actions deploy job stays fast and reproducible.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");
const PUBLIC_DIR = path.join(ROOT, "public");
const CONTENT_POSTS = path.join(ROOT, "content", "posts");
const ADMIN_BUILD = path.join(ROOT, "admin");
const DIST = path.join(ROOT, "dist");

// ---------------------------------------------------------------------------
// fs helpers

function rimraf(target) {
  if (!fs.existsSync(target)) return;
  fs.rmSync(target, { recursive: true, force: true });
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function writeFile(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf8");
}

// ---------------------------------------------------------------------------
// frontmatter parser (YAML-subset: scalar, list, ISO datetime - no nesting)

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: raw };
  const yaml = match[1];
  const body = match[2];
  const data = {};
  const lines = yaml.split(/\r?\n/);
  let currentListKey = null;
  let blockKey = null;        // key currently accumulating a |/|- block scalar
  let blockMode = null;       // "|" preserves newlines, ">" folds them
  let blockChomp = null;      // "-" strips trailing newline, default keeps
  let blockBuf = [];

  const flushBlock = () => {
    if (blockKey == null) return;
    let value;
    if (blockMode === ">") {
      value = blockBuf.join(" ").replace(/\s+/g, " ").trim();
    } else {
      value = blockBuf.join("\n");
      if (blockChomp !== "-") value = value.replace(/\n+$/, "") + "\n";
      else value = value.replace(/\n+$/, "");
    }
    data[blockKey] = value;
    blockKey = null; blockMode = null; blockChomp = null; blockBuf = [];
  };

  for (const line of lines) {
    if (blockKey != null) {
      const indented = line.match(/^(\s+)(.*)$/);
      if (indented && (line.trim() !== "" || blockBuf.length)) {
        blockBuf.push(indented[2]);
        continue;
      }
      if (line.trim() === "") { blockBuf.push(""); continue; }
      flushBlock();
    }
    if (!line.trim()) {
      currentListKey = null;
      continue;
    }
    const listItem = line.match(/^\s+-\s+(.+)$/);
    if (listItem && currentListKey) {
      data[currentListKey].push(stripQuotes(listItem[1].trim()));
      continue;
    }
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    const value = kv[2].trim();
    // YAML block scalar?  |  |-  >  >-
    const block = value.match(/^([|>])([+-]?)\s*$/);
    if (block) {
      blockKey = key;
      blockMode = block[1];
      blockChomp = block[2] || null;
      blockBuf = [];
      currentListKey = null;
      continue;
    }
    if (value === "") {
      data[key] = [];
      currentListKey = key;
      continue;
    }
    currentListKey = null;
    if (value === "true") data[key] = true;
    else if (value === "false") data[key] = false;
    else data[key] = stripQuotes(value);
  }
  flushBlock();
  return { data, body };
}


// ---------------------------------------------------------------------------
// House style: no em-dashes anywhere. (User preference, 2026-05-11.)
function lintNoEmDash() {
  const FORBIDDEN = "\u2014"; // —
  const targets = [SRC, path.join(ROOT, "content")];
  const offenders = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(p); continue; }
      if (!/\.(html?|css|js|mjs|cjs|md|json)$/i.test(entry.name)) continue;
      const txt = fs.readFileSync(p, "utf8");
      if (txt.includes(FORBIDDEN)) offenders.push(p);
    }
  };
  walk(targets[0]); walk(targets[1]);
  if (offenders.length) {
    console.error("[build] em-dash (\u2014) found in:");
    offenders.forEach(p => console.error("  " + p));
    console.error("[build] Replace with a hyphen, colon, or rephrase. House style is to avoid em-dashes.");
    process.exit(1);
  }
}

function stripQuotes(s) {
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}

// ---------------------------------------------------------------------------
// tiny markdown -> html (paragraphs, headings, bold, italic, inline code, links, lists)

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderInline(s) {
  let out = escapeHtml(s);
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" rel="noopener">$1</a>',
  );
  return out;
}

function renderMarkdown(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let paragraph = [];
  let list = null; // { type: 'ul'|'ol', items: [] }

  const flushParagraph = () => {
    if (paragraph.length) {
      out.push(`<p>${renderInline(paragraph.join(" ").trim())}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      const tag = list.type;
      out.push(
        `<${tag}>${list.items
          .map((i) => `<li>${renderInline(i)}</li>`)
          .join("")}</${tag}>`,
      );
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      out.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }
    const ul = line.match(/^[-*]\s+(.*)$/);
    if (ul) {
      flushParagraph();
      if (!list || list.type !== "ul") {
        flushList();
        list = { type: "ul", items: [] };
      }
      list.items.push(ul[1]);
      continue;
    }
    const ol = line.match(/^\d+\.\s+(.*)$/);
    if (ol) {
      flushParagraph();
      if (!list || list.type !== "ol") {
        flushList();
        list = { type: "ol", items: [] };
      }
      list.items.push(ol[1]);
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// posts pipeline

function slugify(name) {
  return name
    .replace(/\.md$/i, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function loadPosts() {
  if (!fs.existsSync(CONTENT_POSTS)) return [];
  const posts = [];
  for (const file of fs.readdirSync(CONTENT_POSTS)) {
    if (!file.endsWith(".md")) continue;
    const raw = fs.readFileSync(path.join(CONTENT_POSTS, file), "utf8");
    const { data, body } = parseFrontmatter(raw);
    posts.push({
      slug: slugify(file),
      title: data.title || file,
      date: data.date || "",
      author: data.author || "",
      tags: Array.isArray(data.tags) ? data.tags : [],
      excerpt: data.excerpt || "",
      published: data.published === true,
      bodyMarkdown: body,
    });
  }
  posts.sort((a, b) => new Date(b.date) - new Date(a.date));
  return posts;
}

function writePostsJson(posts) {
  const serialisable = posts.map(
    ({ bodyMarkdown: _omit, ...rest }) => rest,
  );
  writeFile(
    path.join(DIST, "data", "posts.json"),
    JSON.stringify(serialisable, null, 2),
  );
}

function renderPostPages(posts) {
  const tplPath = path.join(SRC, "pages", "blog-post.html");
  if (!fs.existsSync(tplPath)) return;
  const tpl = fs.readFileSync(tplPath, "utf8");
  for (const post of posts) {
    if (!post.published) continue;
    const bodyHtml = renderMarkdown(post.bodyMarkdown);
    const html = tpl
      .replace(/\{\{title\}\}/g, escapeHtml(post.title))
      .replace(/\{\{date\}\}/g, escapeHtml(post.date))
      .replace(/\{\{author\}\}/g, escapeHtml(post.author))
      .replace(/\{\{excerpt\}\}/g, escapeHtml(post.excerpt))
      .replace(/\{\{body\}\}/g, bodyHtml);
    writeFile(path.join(DIST, "pages", "blog", `${post.slug}.html`), html);
  }
}

// ---------------------------------------------------------------------------
// main

function main() {
  console.log("[build] cleaning dist/");
  lintNoEmDash();
  rimraf(DIST);

  console.log("[build] copying src/ -> dist/");
  copyDir(SRC, DIST);

  console.log("[build] copying public/ -> dist/");
  copyDir(PUBLIC_DIR, DIST);

  if (fs.existsSync(ADMIN_BUILD)) {
    console.log("[build] copying admin/ (tinacms build output) -> dist/admin");
    copyDir(ADMIN_BUILD, path.join(DIST, "admin"));
  } else {
    console.log("[build] no admin/ build found (run `tinacms build` first) - skipping");
  }

  // Index page: surface /src/pages/index.html at /
  const indexSrc = path.join(SRC, "pages", "index.html");
  if (fs.existsSync(indexSrc)) {
    fs.copyFileSync(indexSrc, path.join(DIST, "index.html"));
  }

  const posts = loadPosts();
  console.log(
    `[build] found ${posts.length} post(s), ${posts.filter((p) => p.published).length} published`,
  );
  writePostsJson(posts);
  renderPostPages(posts);

  console.log("[build] done - output in /dist");
}

main();
