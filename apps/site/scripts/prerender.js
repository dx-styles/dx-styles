// Injects server-rendered markup and static global styles into dist/index.html
// so the landing page is fully readable without JavaScript (crawlers, link
// previews, no-JS readers). Runs after the client and SSR builds.
import { readFile, rm, writeFile } from "node:fs/promises";

const distIndexUrl = new URL("../dist/index.html", import.meta.url);
const ssrOutDirUrl = new URL("../dist-ssr/", import.meta.url);
const ssrEntryUrl = new URL("entry-prerender.js", ssrOutDirUrl);

const { render, siteResetCss, siteTheme } = await import(ssrEntryUrl.href);

const appHtml = render();
if (typeof appHtml !== "string" || appHtml.length < 1000) {
  throw new Error(`prerender: suspiciously small app markup (${appHtml.length} chars)`);
}

let html = await readFile(distIndexUrl, "utf8");

const replaceOnce = (source, marker, replacement) => {
  if (!source.includes(marker)) {
    throw new Error(`prerender: marker not found in dist/index.html: ${marker}`);
  }
  return source.replace(marker, replacement);
};

html = replaceOnce(html, '<html lang="en">', `<html lang="en" class="${siteTheme}">`);
html = replaceOnce(
  html,
  "</head>",
  `  <style data-dx-site-reset="true">${siteResetCss}</style>\n  </head>`,
);
html = replaceOnce(html, '<div id="root"></div>', `<div id="root">${appHtml}</div>`);

await writeFile(distIndexUrl, html);
await rm(ssrOutDirUrl, { recursive: true, force: true });

console.log(`prerender: injected ${appHtml.length} chars of markup into dist/index.html`);
