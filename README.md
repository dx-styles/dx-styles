# dx-styles

Compiler-backed CSS-in-TS for zero-runtime, deterministic styling in design systems.

Use it when you need:

- deterministic class generation from TypeScript style objects
- variant-driven styling through `recipe(...)`
- multipart styling through `slotRecipe(...)`
- token contracts, themes, and runtime CSS variable assignment
- opt-in compile-time RTL overrides for conservative physical-side declarations

This package does not insert styles at runtime. CSS is emitted by the shared build pipeline and loaded as normal module-side artifacts.

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

## Style Handle Serialization

Public `StyleHandle` values carry a frozen enumerable `__dxStyles` descriptor so WyW can serialize
handles during static extraction through the normal package root import. The descriptor is reserved
for `dx-styles`; consumers pass handles back to `css(...)`, `createRecipeStyleHandles(...)`, and
`createSlotRecipeStyleHandles(...)` rather than reading or persisting descriptor fields.

## Repo Tooling

- From this repository checkout: `bun run explain -- <path/to/file.wyw-in-js.json> <className...>`
- WyW metadata builds surface `dx-styles` development diagnostics for direction-aware authoring.
