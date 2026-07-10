# Migrating from Pigment CSS

Pigment CSS and dx-styles are built on the same engine — wyw-in-js — so the mental model transfers
directly: styles are extracted at build time, theming compiles to CSS variables, components stay
compatible with React Server Components. With Pigment
[in alpha and currently on hold](https://github.com/mui/pigment-css), dx-styles offers an actively
maintained home for the same architecture; concepts map closely.

## Setup

Replace the Pigment bundler plugin with the wyw integration plus dx-styles (see
[Getting started](../getting-started.md) and [WyW integration](../wyw-integration.md)):

```sh
npm remove @pigment-css/react @pigment-css/vite-plugin
npm install dx-styles
npm install -D @wyw-in-js/vite   # or @wyw-in-js/nextjs for Next.js
```

## Pattern map

| Pigment CSS | dx-styles |
|---|---|
| `css` (template or object) | `css({ … })` — object syntax (see [Authoring](../authoring.md)) |
| `styled('button')({ … })` | Component + `className` from `css(...)` / `recipe(...)` |
| `variants` array in `styled` | `variants` map in [`recipe(...)`](../recipes.md) (+ `compoundVariants`) |
| `sx` prop | `css(...)` classes composed with [`cx(...)`](../authoring.md); dynamic values via `assignVars` |
| `extendTheme(...)` + `theme.vars.*` | [`createTokenContract` + `createTheme`](../tokens-and-themes.md); reference `tokens.*` directly |
| `globalCss` | A plain `.css` file imported once |
| `keyframes` | `@keyframes` in a plain `.css` file, referenced by name |
| `generateForBothDir` (whole-output RTL) | [`$rtl` subtree markers](../rtl.md) — opt-in, per style object |
| `useTheme()` for style values | Token references resolve at build time; runtime reads use `var(...)` |

## Variants

Pigment's `variants` arrays become a keyed map with typed selection:

```tsx
// Pigment
const Button = styled("button")({
  borderRadius: 999,
  variants: [
    { props: { size: "sm" }, style: { minHeight: "28px" } },
    { props: { size: "md" }, style: { minHeight: "36px" } },
  ],
});

// dx-styles
const button = recipe({
  base: { borderRadius: "999px" },
  variants: { size: { sm: { minHeight: "28px" }, md: { minHeight: "36px" } } },
  defaultVariants: { size: "md" },
});

export const Button = ({ size, ...rest }: ButtonProps) => (
  <button className={button({ size })} {...rest} />
);
```

Prop-combination rules (`props: { size: "sm", color: "primary" }`) become `compoundVariants`
entries.

## Theming

`extendTheme` output and `theme.vars` references map onto a contract:

```ts
export const tokens = createTokenContract(
  { palette: { primary: null, primaryText: null } },
  { prefix: "app" },
);
export const light = createTheme(tokens, { palette: { primary: "#4c5ce0", primaryText: "#fff" } });
export const dark = createTheme(tokens, { palette: { primary: "#7c8cff", primaryText: "#080a12" } });
```

Where Pigment wires theme selection through its plugin config, dx-styles keeps it in userland:
apply the theme class at a stable boundary and swap it to switch themes — no plugin coupling.

## RTL

`generateForBothDir: true` flips the entire output; dx-styles inverts the default: physical
declarations stay as authored unless a subtree opts in with `$rtl: true`, which emits a scoped
`:dir(rtl) &` override (details and the supported property list in [RTL authoring](../rtl.md)).
Prefer logical properties for new code; use markers for the remainder.

## Incremental migration

Both libraries can coexist during migration (separate plugins, non-conflicting class namespaces),
but since Pigment projects are typically small-to-mid and the APIs are this close, a single focused
pass is usually cheaper than a long coexistence window:

1. Swap plugins; port theme config onto a token contract.
2. Convert `styled` calls to recipes + `className` components; keep markup identical.
3. Replace `sx` usages with authored classes (or `assignVars` where values are dynamic).
4. Move `globalCss`/`keyframes` into plain CSS.

## Checklist

- [ ] Bundler plugin swapped to the wyw integration; build is green.
- [ ] Theme values live in a token contract; no `theme.vars` reads.
- [ ] `styled` variants converted to `recipe`/`compoundVariants`.
- [ ] No `sx` props; dynamic styling flows through `assignVars`.
- [ ] RTL needs covered by logical properties or `$rtl` markers.
