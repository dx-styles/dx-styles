---
"dx-styles": minor
---

`createTokenContract()` now resolves statically at build time. The processor
ships a wyw-in-js manifest with `token-contract-call` semantics, so files
that import a token contract read its value without executing the contract
module (or its dependency graph) during evaluation — consumers like `css()`
and `createTheme()` receive the contract as a static input. Leaf naming is
unchanged, and non-static shapes or prefixes keep falling back to the eval
path with identical output. Requires `@wyw-in-js/transform` ^2.2.0; the
`@wyw-in-js/*` dependency floors are bumped accordingly.
