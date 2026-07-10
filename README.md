# dx-styles

**Zero-runtime CSS-in-TS for design systems.**

[![npm](https://img.shields.io/npm/v/dx-styles)](https://www.npmjs.com/package/dx-styles)
[![license](https://img.shields.io/npm/l/dx-styles)](./LICENSE)
[![CI](https://github.com/dx-styles/dx-styles/actions/workflows/ci.yml/badge.svg)](https://github.com/dx-styles/dx-styles/actions/workflows/ci.yml)

Authoring stays in TypeScript; CSS is statically extracted at build time. No style runtime, no
providers, no FOUC — and class names that are deterministic enough to treat as a contract.

```ts
import { createTheme, createTokenContract, css, recipe } from "dx-styles";

export const tokens = createTokenContract(
  { color: { accent: null, accentFg: null }, radius: { md: null } },
  { prefix: "app" },
);

export const dark = createTheme(tokens, {
  color: { accent: "#7c8cff", accentFg: "#080a12" },
  radius: { md: "12px" },
});

export const card = css({
  padding: "32px",
  borderRadius: tokens.radius.md,
});

export const button = recipe({
  base: { display: "inline-flex", borderRadius: "999px", fontWeight: 600 },
  variants: {
    appearance: {
      primary: { backgroundColor: tokens.color.accent, color: tokens.color.accentFg },
      ghost: { backgroundColor: "transparent", color: tokens.color.accent },
    },
    size: {
      sm: { minHeight: "28px", paddingInline: "12px" },
      md: { minHeight: "36px", paddingInline: "16px" },
    },
  },
  defaultVariants: { appearance: "primary", size: "md" },
});

// <button className={button({ appearance: "ghost" })} />
```

At build time this becomes a static `.css` file and plain class-name strings — nothing else ships
to the browser, and the markup works unchanged in React Server Components.

## Try it

- [Vite starter on StackBlitz](https://stackblitz.com/github/dx-styles/dx-styles/tree/main/examples/vite) — token contract, two themes, `css()` + `recipe()`.
- [Next.js starter on StackBlitz](https://stackblitz.com/github/dx-styles/dx-styles/tree/main/examples/next) — the same demo running in React Server Components.

Both starters live in [`examples/`](./examples) and run locally with `npm install && npm run dev`.

## Why dx-styles

Runtime CSS-in-JS doesn't fit today's React: concurrent rendering and Server Components left
styled-components in maintenance mode, and the compile-time successors are still settling. dx-styles
is built by the maintainer of Linaria and the author of [wyw-in-js](https://github.com/Anber/wyw-in-js) —
the compile-time engine that powers Linaria and MUI's Pigment CSS — as the library a design system
actually needs on top of that engine:

- **Deterministic class generation.** Semantic component classes are stable across builds and
  machines — snapshot them, cache on them, diff them. The [explain tooling](./docs/explain.md)
  traces every class back to its source.
- **Variants as a first-class API** — [`recipe(...)`](./docs/recipes.md) and multipart
  [`slotRecipe(...)`](./docs/slot-recipes.md) with typed variants and defaults.
- **Token contracts** — [`createTokenContract` / `createTheme` / `assignVars`](./docs/tokens-and-themes.md):
  themes are typed contracts, not naming conventions.
- **Opt-in compile-time RTL** — [conservative physical-side overrides](./docs/rtl.md) generated at
  build time.

## How it compares

Every column is a good library; pick by constraints. Corrections welcome —
[open an issue](https://github.com/dx-styles/dx-styles/issues).

| | dx-styles | Linaria | Pigment CSS | vanilla-extract | Panda CSS | StyleX |
|---|---|---|---|---|---|---|
| Zero runtime | ✅ | ✅ | ✅ | ✅ | ✅ | ~✅ ¹ |
| Styles colocated in components | ✅ | ✅ | ✅ | ❌ (`.css.ts` files) | ✅ | ✅ |
| Recipes / slot recipes | ✅ / ✅ | ❌ | ± ² / ❌ | ✅ ³ / ❌ | ✅ / ✅ | ± ⁴ |
| Token contracts + themes | ✅ | ❌ (manual CSS vars) | ✅ | ✅ | ✅ | ✅ |
| Compile-time RTL | ✅ | ❌ | ✅ ⁵ | ❌ | ± logical properties | ± logical properties |
| Project status | active | maintained (stable) ⁶ | alpha, on hold | active | active | active |

- ¹ StyleX ships a small runtime for style merging.
- ² `variants` inside `styled()`; no standalone recipe or slot primitive.
- ³ Via `@vanilla-extract/recipes`.
- ⁴ A documented composition pattern rather than a first-class API.
- ⁵ Via `generateForBothDir`.
- ⁶ New engine work happens in [wyw-in-js](https://github.com/Anber/wyw-in-js).

## Public API

- `css`
- `recipe`
- `slotRecipe`
- `createStyleHandle`
- `createRecipeStyleHandles`
- `createSlotRecipeStyleHandles`
- `cx`
- `createTokenContract`
- `createTheme`
- `assignVars`

## Docs

- [Docs index](./docs/README.md)
- [Getting started](./docs/getting-started.md)
- [WyW integration](./docs/wyw-integration.md)
- [Release process](./docs/release-process.md)

Migrating from another library? Dedicated guides:
[styled-components](./docs/migration/from-styled-components.md) ·
[Linaria](./docs/migration/from-linaria.md) ·
[Pigment CSS](./docs/migration/from-pigment-css.md)

## Style Handle Serialization

Public `StyleHandle` values carry a frozen enumerable `__dxStyles` descriptor so WyW can serialize
handles during static extraction through the normal package root import. The descriptor is reserved
for `dx-styles`; consumers pass handles back to `css(...)`, `createRecipeStyleHandles(...)`, and
`createSlotRecipeStyleHandles(...)` rather than reading or persisting descriptor fields.

## Repo Tooling

- From this repository checkout: `bun run explain -- <path/to/file.wyw-in-js.json> <className...>`
- WyW metadata builds surface `dx-styles` development diagnostics for direction-aware authoring.

## License

MIT © Anton Evzhakov
