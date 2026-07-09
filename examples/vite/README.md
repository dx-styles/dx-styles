# dx-styles + Vite starter

Zero-runtime CSS-in-TS: every style in this app is extracted to a static CSS file at build time.

**[Open in StackBlitz](https://stackblitz.com/github/dx-styles/dx-styles/tree/main/examples/vite)** — runs in the browser, no local setup.

## Run locally

```sh
npm install
npm run dev
```

## What to look at

- [`src/theme.ts`](src/theme.ts) — a token contract and two themes built from it. Switching themes at runtime swaps a single class; the CSS custom properties were generated at build time.
- [`src/styles.ts`](src/styles.ts) — `css()` for one-off styles and `recipe()` for variant-driven components, both referencing the token contract.
- [`vite.config.ts`](vite.config.ts) — the whole integration: one WyW plugin entry.

Run `npm run build` and inspect `dist/assets/*.css` — deterministic class names, plain static CSS, and no style runtime in the JS bundle.

## Docs

https://github.com/dx-styles/dx-styles/tree/main/docs
