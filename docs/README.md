# dx-styles Docs

`dx-styles` is a compiler-backed CSS-in-TS package for deterministic static CSS extraction.

The authoring API is small:

- `css(...)` for static style objects and composition.
- `recipe(...)` for one-element variant selectors.
- `slotRecipe(...)` for multipart variant selectors.
- `createTokenContract(...)`, `createTheme(...)`, and `assignVars(...)` for CSS variable contracts.
- `cx(...)` for runtime class name joining without creating CSS.

## Guides

- [Getting started](./getting-started.md)
- [Authoring styles](./authoring.md)
- [Recipes](./recipes.md)
- [Slot recipes](./slot-recipes.md)
- [Tokens and themes](./tokens-and-themes.md)
- [Runtime values](./runtime-values.md)
- [RTL authoring](./rtl.md)
- [WyW integration](./wyw-integration.md)
- [Explain tooling](./explain.md)
- [Release process](./release-process.md)

## Migration

- [From styled-components](./migration/from-styled-components.md)
- [From Linaria](./migration/from-linaria.md)
- [From Pigment CSS](./migration/from-pigment-css.md)

## Runtime Model

`dx-styles` does not insert CSS rules at runtime. Build tooling extracts authored style objects into
CSS artifacts, and runtime code only selects classes or assigns CSS custom properties.

Use direct package imports for extracted APIs:

```ts
import { css, recipe, slotRecipe } from "dx-styles";
```

Runtime helpers are also available from the package root. The low-level runtime entrypoint is
`dx-styles/runtime`, and static evaluation code uses `dx-styles/preeval-runtime`.
