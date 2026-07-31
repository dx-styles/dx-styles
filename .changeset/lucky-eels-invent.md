---
"dx-styles": minor
---

Type style objects with `csstype` so editors complete CSS properties and values

Inside `css({ ... })` editors offered the 49 members of `String` — `charAt`,
`toLowerCase`, even `blink` and `fontcolor` — and not a single CSS property
([#26](https://github.com/dx-styles/dx-styles/issues/26)). Two causes:
`StyleObject` was a bare string index signature with no known keys, and
`CssClassName` was a `string & { brand }` intersection. An intersection is an
object type, so TypeScript pulled in the whole `String` apparent type wherever
`StylePart` contextually typed an object literal — `css()`, `recipe()` base and
variant values, and `slotRecipe()` slots alike.

`StyleObject` now builds on `csstype`'s `PropertiesFallback`, and `CssClassName`
is a `` `dxs_${string}` `` template literal — a plain string subtype that
contributes no completions while still rejecting arbitrary class-name strings,
which `resolveStylePart` throws on at runtime.

Style objects stay just as open as before: custom properties, nested selectors,
at-rules, fallback value arrays, and properties `csstype` does not know yet all
still typecheck through the index signature. The `$rtl` and `$noflip` markers
are now declared, so editors complete them too.

Three type-level changes can surface code that already failed at runtime, or
that leaned on the previous looseness:

- `$rtl`/`$noflip` set to anything but `true` (the runtime threw on this).
- A boolean value on a real CSS property (the runtime threw on this too).
- Assigning a plain `string` to `CssClassName`; it now needs a value that a
  `css()`, `recipe()`, or `slotRecipe()` call produced.

One more consequence is worth knowing about. `StyleObject` used to declare no
properties at all, which exempted it from TypeScript's weak-type check. Now that
it has the CSS properties, passing a `StyleObject` where a slot map
(`Partial<Record<TSlot, StylePart>>`) is expected reports "no properties in
common" instead of silently passing. That shows up in helpers typed to return
`StyleObject` while actually returning a slot map; making such a helper generic
over its value type both fixes the error and keeps the real shape:

```ts
function createVariants<const T extends readonly string[], TStyle = StyleObject>(
  options: T,
  styles: (option: T[number]) => TStyle,
): Record<T[number], TStyle>;
```
