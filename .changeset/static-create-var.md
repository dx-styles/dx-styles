---
"dx-styles": minor
---

`createVar()` now resolves statically at build time. The processor ships a
wyw-in-js manifest with `css-var-call` semantics: a private var's value form
is a pure function of its hashed slug (`var(--<hash>)`) with zero call
inputs, so files that declare or import private vars no longer drag their
modules into build-time evaluation. Output is unchanged.
