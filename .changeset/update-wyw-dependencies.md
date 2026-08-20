---
"dx-styles": patch
---

Update WyW dependencies to the latest 2.4.x releases and refresh starter example locks so their npm audits pass.

The newer WyW transform also removes a few recently documented engine workarounds: inline
`:global(...)` animation values now emit valid global animation references, forced `execute`
transforms keep the side-effect import that carries cross-file `@keyframes` CSS, and explain
metadata now carries rule records directly.
