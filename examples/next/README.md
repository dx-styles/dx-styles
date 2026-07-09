# dx-styles + Next.js starter

Zero-runtime CSS-in-TS in the Next.js App Router: styles are extracted at build time, so they work
in React Server Components — no style runtime, no context providers.

**[Open in StackBlitz](https://stackblitz.com/github/dx-styles/dx-styles/tree/main/examples/next)** — runs in the browser, no local setup.

## Run locally

```sh
npm install
npm run dev
```

## What to look at

- [`next.config.mjs`](next.config.mjs) — the whole integration: `withWyw` from `@wyw-in-js/nextjs`.
- [`app/page.tsx`](app/page.tsx) — a **Server Component** using extracted classes directly.
- [`app/theme-shell.tsx`](app/theme-shell.tsx) — a small client component; switching themes swaps a
  single class generated from the token contract in [`app/theme.ts`](app/theme.ts).
- [`app/styles.ts`](app/styles.ts) — `css()` and `recipe()` (variants) referencing the tokens.

## Docs

https://github.com/dx-styles/dx-styles/tree/main/docs
