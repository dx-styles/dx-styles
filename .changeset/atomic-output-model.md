---
"dx-styles": minor
---

Add an atomic output model. With `processors.dxStyles.output: "atomic"`, `css()`, `recipe()` and `slotRecipe()` emit one shared class per declaration, ranked by fixed rules instead of CSS order, and the build fails when a style's result would depend on declaration order or differ from the default model. `cx` now keeps only the last atom of each property and condition. A WyW `classNameSlug` that produces class names of the atom shape (`dx-<key>_<value>`) is now a build error in either model.
