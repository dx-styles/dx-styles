import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import wyw from "@wyw-in-js/vite";
import { defineConfig, type Plugin } from "vite";

import { loadPosts, renderIndex, renderPost, renderRss, renderSitemap } from "./scripts/blog-lib.js";

const workspaceRoot = resolve(__dirname, "..", "..");

// The blog is generated statically into dist/ by scripts/build-blog.js, so the
// dev server has to render the same pages on the fly for /blog/ links to work.
const blogDev = (): Plugin => ({
  name: "dx-site-blog-dev",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      void (async () => {
        if (req.method !== "GET" && req.method !== "HEAD") {
          next();
          return;
        }
        const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
        const send = (body: string, contentType: string) => {
          res.setHeader("Content-Type", contentType);
          res.end(req.method === "HEAD" ? undefined : body);
        };
        const includeDrafts = process.env.BLOG_DRAFTS === "1";
        if (pathname === "/rss.xml") {
          send(renderRss(await loadPosts({ includeDrafts })), "application/rss+xml; charset=utf-8");
          return;
        }
        if (pathname === "/sitemap.xml") {
          send(renderSitemap(await loadPosts({ includeDrafts })), "application/xml; charset=utf-8");
          return;
        }
        const blogMatch = pathname.match(/^\/blog(?:\/([^/]+))?\/?$/);
        if (!blogMatch) {
          next();
          return;
        }
        if (!pathname.endsWith("/")) {
          res.statusCode = 301;
          res.setHeader("Location", `${pathname}/`);
          res.end();
          return;
        }
        const posts = await loadPosts({ includeDrafts });
        const slug = blogMatch[1];
        if (slug === undefined) {
          send(renderIndex(posts), "text/html; charset=utf-8");
          return;
        }
        const post = posts.find((candidate) => candidate.slug === slug);
        if (!post) {
          next();
          return;
        }
        send(await renderPost(post), "text/html; charset=utf-8");
      })().catch(next);
    });
  },
});

const dxStylesProcessorByTag: Record<string, string> = {
  css: "css",
  recipe: "recipe",
  slotRecipe: "slotRecipe",
  createTheme: "createTheme",
  createTokenContract: "createTokenContract",
  createVar: "createVar",
};

export default defineConfig({
  root: __dirname,
  plugins: [
    blogDev(),
    react(),
    wyw({
      displayName: true,
      preserveCssPaths: true,
      tagResolver: (source: string, tag: string): string | null => {
        if (source !== "dx-styles") {
          return null;
        }

        const processor = dxStylesProcessorByTag[tag];

        return processor ? resolve(workspaceRoot, "processors", `${processor}.js`) : null;
      },
    }),
  ],
  resolve: {
    alias: [
      {
        find: /^dx-styles\/preeval-runtime$/,
        replacement: resolve(workspaceRoot, "preeval-runtime.ts"),
      },
      {
        find: /^dx-styles$/,
        replacement: resolve(workspaceRoot, "src/index.ts"),
      },
      {
        find: /^dx-styles\/runtime$/,
        replacement: resolve(workspaceRoot, "src/runtime/index.ts"),
      },
    ],
  },
  base: "./",
});
