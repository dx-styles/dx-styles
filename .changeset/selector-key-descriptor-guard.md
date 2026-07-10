---
"dx-styles": patch
---

Fail the build when a `css()`/`recipe()` result leaks into a style object instead of silently
emitting garbage CSS.

Interpolating a class value into a selector key (`` css({ [`.${parent} &`]: … }) ``), nesting a
`css()` result as a style value (`css({ "&:hover": parent })`), or passing a
`recipe()`/`slotRecipe()`/`createTheme()` result as a `css()` part previously serialized the
build-time descriptor straight into the stylesheet (`.[object Object] .child_x1a2b3c{…}`,
`.child_x1a2b3c:hover __dxStyles{…}`) — surfacing, at best, as a downstream minifier syntax error.
All three shapes now fail static extraction and the runtime fallback with a clear diagnostic:
class values cannot be interpolated into selector keys. Group coordinated elements with
`slotRecipe()`, or target a literal class or data-attribute selector you own.
