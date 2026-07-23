// Generates llms.txt, llms-full.txt, and markdown doc copies under dist/llms/
// so AI assistants and agents can consume the docs at well-known paths
// (https://llmstxt.org convention). Runs after the client build.
import { mkdir, readFile, writeFile } from "node:fs/promises";

const SITE_ORIGIN = "https://dx-styles.dev";
const REPO_ROOT = new URL("../../../", import.meta.url);
const DIST_DIR = new URL("../dist/", import.meta.url);

// Curated, ordered doc set: slug → [source path, one-line description].
const DOCS = [
  ["readme", "README.md", "Package overview, quick example, and library comparison"],
  ["getting-started", "docs/getting-started.md", "Install and bundler setup"],
  ["authoring", "docs/authoring.md", "css() style objects, nesting, composition, cx()"],
  ["recipes", "docs/recipes.md", "recipe(): variant-driven styling for one element"],
  ["slot-recipes", "docs/slot-recipes.md", "slotRecipe(): multipart components"],
  ["tokens-and-themes", "docs/tokens-and-themes.md", "createTokenContract() and createTheme()"],
  ["runtime-values", "docs/runtime-values.md", "assignVars(): dynamic values via CSS custom properties"],
  ["rtl", "docs/rtl.md", "Compile-time RTL: logical properties and $rtl markers"],
  ["wyw-integration", "docs/wyw-integration.md", "How processors plug into wyw-in-js"],
  ["explain", "docs/explain.md", "Tracing emitted classes back to their sources"],
];

const MIGRATIONS = [
  ["migration-from-styled-components", "docs/migration/from-styled-components.md", "Pattern map and incremental plan"],
  ["migration-from-linaria", "docs/migration/from-linaria.md", "Same engine, file-by-file migration"],
  ["migration-from-pigment-css", "docs/migration/from-pigment-css.md", "API mapping from Pigment CSS"],
];

const NOTES = `Key facts for generated code:

- Styles are plain objects: \`css({ ... })\`. Template literals are not supported (a string layer is discussed in https://github.com/dx-styles/dx-styles/issues/18).
- There is no styled() API. Components accept \`className\`; compose classes with \`cx(...)\`.
- Truly dynamic values go through \`assignVars(...)\` (CSS custom properties), never new rules at runtime.
- Variants belong in \`recipe(...)\` / \`slotRecipe(...)\`; theming goes through \`createTokenContract(...)\` + \`createTheme(...)\`.
- Prefer logical CSS properties; mark safely mirrorable physical declarations with \`$rtl: true\`.`;

const readSource = async (path) => readFile(new URL(path, REPO_ROOT), "utf8");

const linkList = (entries) =>
  entries
    .map(([slug, , desc]) => `- [${titleOf(slug)}](${SITE_ORIGIN}/llms/${slug}.md): ${desc}`)
    .join("\n");

const titles = new Map();
function titleOf(slug) {
  return titles.get(slug) ?? slug;
}

const main = async () => {
  await mkdir(new URL("llms/", DIST_DIR), { recursive: true });

  const contents = new Map();
  for (const [slug, path] of [...DOCS, ...MIGRATIONS]) {
    const text = await readSource(path);
    const heading = text.match(/^# (.+)$/m);
    titles.set(slug, heading ? heading[1].trim() : slug);
    contents.set(slug, text);
    await writeFile(new URL(`llms/${slug}.md`, DIST_DIR), text);
  }

  const index = `# dx-styles

> Zero-runtime CSS-in-TS for design systems: typed recipes and slot recipes, token contracts, and opt-in compile-time RTL. Styles are statically extracted at build time; no style runtime ships to the browser, and components work unchanged in React Server Components.

${NOTES}

## Docs

${linkList(DOCS)}

## Migration guides

${linkList(MIGRATIONS)}
`;

  const full = [
    `# dx-styles — full documentation\n\n> Concatenated from ${SITE_ORIGIN} docs. Index: ${SITE_ORIGIN}/llms.txt\n\n${NOTES}`,
    ...[...DOCS, ...MIGRATIONS].map(
      ([slug, path]) =>
        `---\n\nSource: ${SITE_ORIGIN}/llms/${slug}.md (${path})\n\n${contents.get(slug).trim()}`,
    ),
  ].join("\n\n");

  await writeFile(new URL("llms.txt", DIST_DIR), index);
  await writeFile(new URL("llms-full.txt", DIST_DIR), full);
  console.log(
    `llms: index ${index.length} chars, full ${full.length} chars, ${contents.size} doc copies written`,
  );
};

await main();
