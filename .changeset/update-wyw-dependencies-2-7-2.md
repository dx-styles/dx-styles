---
"dx-styles": patch
---

Require WyW 2.7.2 or newer. This moves `minimatch` from the 9.x line, which has no fix for a denial-of-service advisory, to 11.0.5. Update your bundler integration (`@wyw-in-js/vite`, `@wyw-in-js/nextjs` and the like) to 2.7.2 as well: it pins the exact version of `@wyw-in-js/transform`.
