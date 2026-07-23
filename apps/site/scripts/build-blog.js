// Generates static /blog pages, rss.xml, and sitemap.xml from markdown content
// in content/blog. Runs after the client build and writes straight into dist/.
// Drafts (frontmatter `draft: true`) are skipped unless BLOG_DRAFTS=1.
import { mkdir, writeFile } from "node:fs/promises";

import { loadPosts, renderIndex, renderPost, renderRss, renderSitemap } from "./blog-lib.js";

const DIST_DIR = new URL("../dist/", import.meta.url);
const includeDrafts = process.env.BLOG_DRAFTS === "1";

const posts = await loadPosts({ includeDrafts });

await mkdir(new URL("blog/", DIST_DIR), { recursive: true });
await writeFile(new URL("blog/index.html", DIST_DIR), renderIndex(posts));
for (const post of posts) {
  await mkdir(new URL(`blog/${post.slug}/`, DIST_DIR), { recursive: true });
  await writeFile(new URL(`blog/${post.slug}/index.html`, DIST_DIR), await renderPost(post));
}
await writeFile(new URL("rss.xml", DIST_DIR), renderRss(posts));
await writeFile(new URL("sitemap.xml", DIST_DIR), renderSitemap(posts));

console.log(
  `blog: ${posts.length} post(s) rendered${includeDrafts ? " (drafts included)" : ""}, rss.xml + sitemap.xml written`,
);
