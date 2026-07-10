# Migrating from styled-components

styled-components resolves styles at runtime; dx-styles extracts them at build time. The practical
consequences: no `ThemeProvider`, no style runtime in the bundle, no SSR style collection — and the
same components work in React Server Components. Migration is mechanical for most patterns and can
run incrementally: both libraries coexist in one app without conflicts.

## Setup

Add dx-styles alongside styled-components (see [Getting started](../getting-started.md)):

```sh
npm install dx-styles
npm install -D @wyw-in-js/vite   # or the integration for your bundler
```

Keep `ThemeProvider` and the styled-components Babel plugin in place until the last styled component
is gone.

## Pattern map

| styled-components | dx-styles |
|---|---|
| `styled.button`…`` | `recipe(...)` or `css(...)` + `<button className={...}>` |
| Props in template (`${p => p.primary ? … : …}`) | `variants` in [`recipe(...)`](../recipes.md) |
| Continuous dynamic values (`${p => p.width}px`) | [`assignVars(...)`](../runtime-values.md) → inline CSS variables |
| `ThemeProvider` + `${p => p.theme.x}` | [`createTokenContract` + `createTheme`](../tokens-and-themes.md) — a class, no provider |
| `css`…`` mixins | `css(...)` composition: `css(focusRing, { … })` |
| `styled(Component)` wrapping | The component takes `className`; compose with [`cx(...)`](../authoring.md) |
| `${OtherComponent}` in selectors | [`slotRecipe(...)`](../slot-recipes.md) for coordinated elements (see below) |
| `createGlobalStyle` | A plain `.css` file imported once |
| `keyframes` | `@keyframes` in a plain `.css` file, referenced by name |
| `.attrs(...)` | Regular JSX props |
| `ServerStyleSheet` / SSR plumbing | Not needed — CSS is a static asset |

## Components with variants

Before:

```tsx
const Button = styled.button`
  display: inline-flex;
  border-radius: 999px;
  min-height: ${(p) => (p.$small ? "28px" : "36px")};
  background: ${(p) => (p.$primary ? p.theme.accent : "transparent")};
`;
```

After:

```tsx
import { recipe } from "dx-styles";
import { tokens } from "./theme";

const button = recipe({
  base: { display: "inline-flex", borderRadius: "999px" },
  variants: {
    size: {
      sm: { minHeight: "28px" },
      md: { minHeight: "36px" },
    },
    appearance: {
      primary: { backgroundColor: tokens.color.accent },
      ghost: { backgroundColor: "transparent" },
    },
  },
  defaultVariants: { size: "md", appearance: "primary" },
});

export const Button = ({ size, appearance, ...rest }: ButtonProps) => (
  <button className={button({ size, appearance })} {...rest} />
);
```

Boolean props become named variant values; the finite prop combinations you were branching on in
templates become extracted classes selected at runtime.

## Truly dynamic values

Values that are genuinely unbounded (user-picked colors, measured widths) become CSS custom
properties instead of new rules:

```tsx
import { assignVars } from "dx-styles";
import { tokens } from "./theme";

<section style={assignVars(tokens, { color: { accent: selectedColor } })}>…</section>;
```

The extracted CSS references `var(...)`; runtime only assigns values.

## Theming

`ThemeProvider` context becomes a typed contract plus theme classes:

```ts
import { createTheme, createTokenContract } from "dx-styles";

export const tokens = createTokenContract(
  { color: { accent: null, accentFg: null } },
  { prefix: "app" },
);
export const dark = createTheme(tokens, { color: { accent: "#7c8cff", accentFg: "#080a12" } });
export const light = createTheme(tokens, { color: { accent: "#4c5ce0", accentFg: "#ffffff" } });
```

Apply the theme class at any stable boundary (`<html>`, app shell, a subtree). Reading
`p => p.theme.x` in templates becomes referencing `tokens.color.x` in style objects — resolved at
build time to `var(--app-color-x)`.

## `${Component}` selectors

Selector interpolation of one component inside another does not port literally — interpolating a
class into a selector key is not supported. When elements are styled as a coordinated group, that is
a [slot recipe](../slot-recipes.md):

```tsx
const card = slotRecipe({
  slots: ["root", "icon"],
  base: {
    root: { display: "grid" },
    icon: { opacity: 0.6 },
  },
  variants: {
    state: {
      hover: { icon: { opacity: 1 } },
    },
  },
});
```

For cases that must stay selector-driven (e.g. styling on parent hover), use an explicit literal
class or data attribute you own: `"&:hover [data-part='icon']": { … }` inside one style object.

## Incremental migration

1. Add the wyw integration and dx-styles; keep styled-components fully working.
2. Introduce the token contract; map your `theme` object values onto it once.
3. Migrate leaf components first (buttons, badges), then containers. Both class systems compose —
   `cx(dxClass, scClass)` is fine mid-migration.
4. Delete `ThemeProvider`, the Babel plugin, and the styled-components dependency last. The style
   runtime cost only disappears at this final step.

## Checklist

- [ ] No `styled.` factories left; components take `className`.
- [ ] Finite style branches are recipe variants; unbounded values go through `assignVars`.
- [ ] Theme values live in a token contract; no `useTheme` for styling.
- [ ] Global styles and keyframes moved to plain CSS.
- [ ] styled-components, its Babel plugin, and SSR sheet plumbing removed from the bundle.
