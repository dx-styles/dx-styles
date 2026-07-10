# Migrating from Linaria

Written by the person who maintains Linaria. dx-styles runs on the same engine —
[wyw-in-js](https://github.com/Anber/wyw-in-js) — so this is the shortest migration in this folder:
your build pipeline stays wyw-based, evaluation semantics are the ones you already rely on, and both
libraries can be extracted **by the same plugin instance in the same build** while you migrate
file by file.

What you gain: object syntax with typed tokens, first-class variants (`recipe`), multipart
components (`slotRecipe`), token contracts instead of hand-rolled CSS variables, and opt-in
compile-time RTL.

## Setup

If Linaria 6+ already builds through `@wyw-in-js/vite` (or the webpack/Next integrations), add the
package and you are done — tag detection comes from package metadata for both libraries:

```sh
npm install dx-styles
```

```ts
// vite.config.ts — one plugin serves both libraries during migration
wyw({
  prefixer: false,
  processors: { dxStyles: {} },
});
```

## Pattern map

| Linaria | dx-styles |
|---|---|
| `` css`…` `` template | `css({ … })` object (see [Authoring](../authoring.md)) |
| `styled.div` from `@linaria/react` | Component + `className` (no styled API) |
| Interpolated constants (`${gap}px`) | Plain object values — same static evaluation |
| Props interpolation (`${p => …}`) via inline vars | `variants` in [`recipe(...)`](../recipes.md), or [`assignVars(...)`](../runtime-values.md) for continuous values |
| `${Component}` in selectors | [`slotRecipe(...)`](../slot-recipes.md) — see below |
| Manual `--css-vars` theming | [`createTokenContract` / `createTheme`](../tokens-and-themes.md) |
| `cx` from `@linaria/core` | `cx` from `dx-styles` |
| Global styles via `:global()` | A plain `.css` file imported once |

## Template → object

```ts
// Linaria
export const card = css`
  display: grid;
  gap: 12px;
  &:hover {
    border-color: var(--accent);
  }
`;

// dx-styles
export const card = css({
  display: "grid",
  gap: "12px",
  "&:hover": {
    borderColor: tokens.color.accent,
  },
});
```

Nested selectors and at-rules carry over with the same `&` semantics. Property names become
camelCase; values become strings (or numbers where unitless is valid).

## `styled` components

dx-styles deliberately has no element factory. A Linaria styled component becomes a component that
selects classes:

```tsx
// Linaria
const Button = styled.button`
  min-height: ${(p) => (p.small ? "28px" : "36px")};
`;

// dx-styles
const button = recipe({
  base: { display: "inline-flex" },
  variants: { size: { sm: { minHeight: "28px" }, md: { minHeight: "36px" } } },
  defaultVariants: { size: "md" },
});

export const Button = ({ size, ...rest }: ButtonProps) => (
  <button className={button({ size })} {...rest} />
);
```

Linaria compiles props interpolations into inline CSS variables under the hood; dx-styles makes the
same split explicit — finite branches are variants, continuous values go through `assignVars`.

## `${Component}` selectors

Do **not** port component-selector interpolation literally: interpolating a class into a selector
key is not supported and will not extract. Elements that were coupled through selectors are a
coordinated group — model them as one [slot recipe](../slot-recipes.md) with explicit slots, or,
where a selector relationship is genuinely required, target a literal class or
`[data-part="…"]` attribute you own inside a single style object.

## Theming

Hand-maintained CSS variable conventions become typed contracts:

```ts
export const tokens = createTokenContract(
  { color: { bg: null, fg: null, accent: null } },
  { prefix: "app" },
);
export const dark = createTheme(tokens, { color: { bg: "#10131a", fg: "#f5f7fb", accent: "#7c8cff" } });
```

Style objects reference `tokens.color.accent` and get `var(--app-color-accent)` in emitted CSS —
the same runtime model you built manually, now typed end to end.

## Incremental migration

1. Add `dx-styles` to the existing wyw-based build; nothing else changes.
2. Migrate per file: template `css` → object `css`, styled → component + recipe. Both libraries'
   classes compose freely (`cx(linariaClass, dxClass)`).
3. Move the variable convention onto a token contract once; delete ad-hoc `--var` strings as files
   migrate.
4. Remove `@linaria/*` dependencies when the last tag is gone.

## Checklist

- [ ] Build runs both libraries through one wyw integration.
- [ ] Template literals converted to style objects; `&` selectors intact.
- [ ] No component-selector interpolations; coordinated elements are slot recipes.
- [ ] CSS variable conventions replaced by a token contract.
- [ ] `@linaria/core` / `@linaria/react` removed at the end.
