---
"dx-styles": minor
---

`css()` and `createTheme()` now resolve statically at build time through
wyw-in-js `preeval-call` manifests backed by this package's own preeval
runtime. Files that define or import css results — including css-in-css
composition chains, same-file and cross-file — no longer execute modules
during evaluation, while eval-domain semantics (descriptor values,
composition, diagnostics) stay byte-identical because the engine calls the
same preeval functions the eval path uses. Requires `@wyw-in-js/transform`
^2.3.0.
