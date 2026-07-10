// Generates static /blog pages, rss.xml, and sitemap.xml from markdown content
// in content/blog. Runs after the client build and writes straight into dist/.
// Drafts (frontmatter `draft: true`) are skipped unless BLOG_DRAFTS=1.
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";

import { marked } from "marked";

const SITE_ORIGIN = "https://dx-styles.dev";
const CONTENT_DIR = new URL("../content/blog/", import.meta.url);
const DIST_DIR = new URL("../dist/", import.meta.url);
const includeDrafts = process.env.BLOG_DRAFTS === "1";

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
`;

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

function renderPost(post) {
  const main = `<article>
        <h1>${escapeHtml(post.title)}</h1>
        <p class="meta">${escapeHtml(post.date)} · Anton Evzhakov</p>
        ${marked.parse(post.body)}
      </article>`;
  return pageShell({
    title: `${post.title} — dx-styles blog`,
    description: post.description,
    canonicalPath: `/blog/${post.slug}/`,
    ogType: "article",
    main,
  });
}

function renderIndex(posts) {
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

function renderRss(posts) {
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

function renderSitemap(posts) {
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

await mkdir(new URL("blog/", DIST_DIR), { recursive: true });
await writeFile(new URL("blog/index.html", DIST_DIR), renderIndex(posts));
for (const post of posts) {
  await mkdir(new URL(`blog/${post.slug}/`, DIST_DIR), { recursive: true });
  await writeFile(new URL(`blog/${post.slug}/index.html`, DIST_DIR), renderPost(post));
}
await writeFile(new URL("rss.xml", DIST_DIR), renderRss(posts));
await writeFile(new URL("sitemap.xml", DIST_DIR), renderSitemap(posts));

console.log(
  `blog: ${posts.length} post(s) rendered${includeDrafts ? " (drafts included)" : ""}, rss.xml + sitemap.xml written`,
);
