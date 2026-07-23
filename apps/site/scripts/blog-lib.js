// Shared blog rendering: loads markdown posts from content/blog and renders
// the HTML pages, rss.xml, and sitemap.xml. Used by scripts/build-blog.js at
// build time and by the dev-server middleware in vite.config.ts.
import { readdir, readFile } from "node:fs/promises";

import { Marked } from "marked";
import { bundledLanguages, codeToHtml } from "shiki";

export const SITE_ORIGIN = "https://dx-styles.dev";
const REPO_URL = "https://github.com/dx-styles/dx-styles";
const CONTENT_DIR = new URL("../content/blog/", import.meta.url);

const CODE_THEME = "tokyo-night";

const markdown = new Marked({
  async: true,
  walkTokens: async (token) => {
    if (token.type !== "code") {
      return;
    }
    const lang = (token.lang ?? "").trim().split(/\s+/)[0];
    const html = await codeToHtml(token.text, {
      lang: lang && lang in bundledLanguages ? lang : "text",
      theme: CODE_THEME,
      colorReplacements: { "#1a1b26": "#0d1019" },
    });
    token.type = "html";
    token.block = true;
    token.text = `${html}\n`;
  },
});

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function parseFrontmatter(source, file) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    throw new Error(`${file}: missing frontmatter`);
  }
  const meta = {};
  for (const line of match[1].split("\n")) {
    if (!line.trim()) {
      continue;
    }
    const kv = line.match(/^([a-zA-Z]+):\s*(.*)$/);
    if (!kv) {
      throw new Error(`${file}: unrecognized frontmatter line: ${line}`);
    }
    meta[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
  }
  for (const key of ["title", "description", "date"]) {
    if (!meta[key]) {
      throw new Error(`${file}: frontmatter is missing "${key}"`);
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) {
    throw new Error(`${file}: date must be YYYY-MM-DD, got "${meta.date}"`);
  }
  return { ...meta, draft: meta.draft === "true", body: source.slice(match[0].length) };
}

export async function loadPosts({ includeDrafts = false } = {}) {
  const files = (await readdir(CONTENT_DIR)).filter((file) => file.endsWith(".md")).sort();
  const posts = [];
  for (const file of files) {
    const source = await readFile(new URL(file, CONTENT_DIR), "utf8");
    const post = parseFrontmatter(source, file);
    post.slug = post.slug ?? file.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/\.md$/, "");
    if (post.draft && !includeDrafts) {
      continue;
    }
    posts.push(post);
  }
  posts.sort((a, b) => (a.date < b.date ? 1 : -1));
  return posts;
}

const BLOG_CSS = `
:root { color-scheme: dark; }
body { margin: 0; background: #080a12; color: #f4f6ff; font: 16px/1.65 system-ui, sans-serif; }
.wrap { max-width: 720px; margin: 0 auto; padding: 48px 20px 80px; }
.site-nav { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 40px; }
.site-nav a { color: #9aa3c0; text-decoration: none; font-size: 14px; }
.site-nav a:hover { color: #f4f6ff; }
.site-nav .brand { color: #f4f6ff; font-weight: 700; font-size: 16px; }
h1 { font-size: 34px; line-height: 1.2; margin: 12px 0 8px; letter-spacing: -0.01em; }
.meta { color: #9aa3c0; font-size: 14px; margin: 0 0 32px; }
article h2 { margin-top: 36px; font-size: 24px; }
article h3 { margin-top: 28px; font-size: 19px; }
article p, article li { color: #cdd3e6; }
a { color: #7c8cff; }
code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 14px; background: #141827; padding: 2px 5px; border-radius: 5px; }
pre { background: #0d1019; border: 1px solid #1c2233; border-radius: 10px; padding: 16px; overflow-x: auto; }
pre code { background: none; padding: 0; }
blockquote { margin: 0; padding-left: 16px; border-left: 3px solid #2a3350; color: #9aa3c0; }
.post-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 28px; }
.post-list h2 { margin: 0 0 4px; font-size: 22px; }
.post-list a { text-decoration: none; color: #f4f6ff; }
.post-list a:hover { color: #7c8cff; }
.post-list p { margin: 6px 0 0; color: #9aa3c0; }
.empty { color: #9aa3c0; }
footer { margin-top: 64px; color: #5a627a; font-size: 13px; }
.github-corner { position: absolute; top: 0; right: 0; color: #080a12; }
.github-corner svg { display: block; fill: #f4f6ff; }
.github-corner .octo-arm { transform-origin: 130px 106px; }
.github-corner:hover .octo-arm { animation: octocat-wave 560ms ease-in-out; }
@keyframes octocat-wave {
  0%, 100% { transform: rotate(0); }
  20%, 60% { transform: rotate(-25deg); }
  40%, 80% { transform: rotate(10deg); }
}
@media (prefers-reduced-motion: reduce) {
  .github-corner:hover .octo-arm { animation: none; }
}
@media (max-width: 840px) {
  .github-corner { display: none; }
}
`;

// SVG geometry from Tim Holman's github-corners (MIT), same as the
// GitHubCorner component on the landing page.
const GITHUB_CORNER = `<a class="github-corner" href="${REPO_URL}" aria-label="View source on GitHub" target="_blank" rel="noreferrer">
      <svg width="80" height="80" viewBox="0 0 250 250" aria-hidden="true">
        <path d="M0,0 L115,115 L130,115 L142,142 L250,250 L250,0 Z" />
        <path class="octo-arm" fill="currentColor" d="M128.3,109.0 C113.8,99.7 119.0,89.6 119.0,89.6 C122.0,82.7 120.5,78.6 120.5,78.6 C119.2,72.0 123.4,76.3 123.4,76.3 C127.3,80.9 125.5,87.3 125.5,87.3 C122.9,97.6 130.6,101.9 134.4,103.2" />
        <path fill="currentColor" d="M115.0,115.0 C114.9,115.1 118.7,116.5 119.8,115.4 L133.7,101.6 C136.9,99.2 139.9,98.4 142.2,98.6 C133.8,88.0 127.5,74.4 143.8,58.0 C148.5,53.4 154.0,51.2 159.7,51.0 C160.3,49.4 163.2,43.6 171.4,40.1 C171.4,40.1 176.1,42.5 178.8,56.2 C183.1,58.6 187.2,61.8 190.9,65.4 C194.5,69.0 197.7,73.2 200.1,77.6 C213.8,80.2 216.3,84.9 216.3,84.9 C212.7,93.1 206.9,96.0 205.4,96.6 C205.1,102.4 203.0,107.8 198.3,112.5 C181.9,128.9 168.3,122.5 157.7,114.1 C157.9,116.9 156.7,120.9 152.7,124.9 L141.0,136.5 C139.8,137.7 141.6,141.9 141.8,141.8 Z" />
      </svg>
    </a>`;

function pageShell({ title, description, canonicalPath, ogType, main }) {
  const canonical = `${SITE_ORIGIN}${canonicalPath}`;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${canonical}" />
    <link rel="alternate" type="application/rss+xml" title="dx-styles blog" href="${SITE_ORIGIN}/rss.xml" />
    <meta property="og:type" content="${ogType}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:site_name" content="dx-styles" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${SITE_ORIGIN}/og-image.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <style>${BLOG_CSS}</style>
  </head>
  <body>
    ${GITHUB_CORNER}
    <div class="wrap">
      <nav class="site-nav">
        <a class="brand" href="/">dx-styles</a>
        <a href="/blog/">Blog</a>
      </nav>
      ${main}
      <footer>© ${new Date().getFullYear()} Anton Evzhakov</footer>
    </div>
  </body>
</html>
`;
}

export async function renderPost(post) {
  const main = `<article>
        <h1>${escapeHtml(post.title)}</h1>
        <p class="meta">${escapeHtml(post.date)} · Anton Evzhakov</p>
        ${await markdown.parse(post.body)}
      </article>`;
  return pageShell({
    title: `${post.title} — dx-styles blog`,
    description: post.description,
    canonicalPath: `/blog/${post.slug}/`,
    ogType: "article",
    main,
  });
}

export function renderIndex(posts) {
  const items = posts
    .map(
      (post) => `<li>
          <a href="/blog/${post.slug}/"><h2>${escapeHtml(post.title)}</h2></a>
          <p class="meta">${escapeHtml(post.date)}</p>
          <p>${escapeHtml(post.description)}</p>
        </li>`,
    )
    .join("\n        ");
  const main = posts.length
    ? `<h1>Blog</h1>
      <ul class="post-list">
        ${items}
      </ul>`
    : `<h1>Blog</h1>
      <p class="empty">First posts are on the way. Subscribe via <a href="/rss.xml">RSS</a>.</p>`;
  return pageShell({
    title: "Blog — dx-styles",
    description: "Compile-time CSS-in-TS, design systems, and zero-runtime styling.",
    canonicalPath: "/blog/",
    ogType: "website",
    main,
  });
}

export function renderRss(posts) {
  const items = posts
    .map(
      (post) => `    <item>
      <title>${escapeHtml(post.title)}</title>
      <link>${SITE_ORIGIN}/blog/${post.slug}/</link>
      <guid>${SITE_ORIGIN}/blog/${post.slug}/</guid>
      <pubDate>${new Date(`${post.date}T09:00:00Z`).toUTCString()}</pubDate>
      <description>${escapeHtml(post.description)}</description>
    </item>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>dx-styles blog</title>
    <link>${SITE_ORIGIN}/blog/</link>
    <description>Compile-time CSS-in-TS, design systems, and zero-runtime styling.</description>
    <language>en</language>
${items}
  </channel>
</rss>
`;
}

export function renderSitemap(posts) {
  const urls = [`${SITE_ORIGIN}/`];
  if (posts.length > 0) {
    urls.push(`${SITE_ORIGIN}/blog/`, ...posts.map((post) => `${SITE_ORIGIN}/blog/${post.slug}/`));
  }
  const entries = urls.map((url) => `  <url>\n    <loc>${url}</loc>\n  </url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
}
