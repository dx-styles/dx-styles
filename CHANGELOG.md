# dx-styles

## 1.4.0

### Minor Changes

- [#29](https://github.com/dx-styles/dx-styles/pull/29) [`1c966dd`](https://github.com/dx-styles/dx-styles/commit/1c966dd197600f33f6af48de63fe32ab2e94579b) Thanks [@BarkovskiyMaxim](https://github.com/BarkovskiyMaxim)! - Add `keyframes()` — deterministic animation names extracted at build time

  `keyframes(frames)` declares a shareable animation and returns its name as a plain string: use it
  as `animationName`, inside an `animation` shorthand, across files, in `recipe()` variants, and in
  theme values. The frames are extracted into a static `@keyframes` rule at build time; the name
  follows the same deterministic generation as `css()` class names. Frames accept declarations only
  (token contract references included); nested selectors and `$rtl`/`$noflip` markers fail the build
  with pointed errors.

  The previously undocumented inline form — a `"@keyframes name"` block nested in `css()` — is now
  documented and covered by tests: the compiler scopes the name per rule and rewrites same-rule
  `animation` references, with `:global(...)` on the declaration key as the unscoped escape hatch.
  Cross-rule references to inline names dangle silently, which is exactly what `keyframes()` is for.
  See `docs/keyframes.md`, including the eval-strategy note for forced-`execute` setups.

  Also fixed in passing: primitive fallback arrays (`opacity: [0, "0%"]`) now serialize as repeated
  declarations in both `css()` rules and keyframes frames — previously they were silently dropped
  from the emitted CSS. Class and animation names are unchanged.

- [#27](https://github.com/dx-styles/dx-styles/pull/27) [`ad66d89`](https://github.com/dx-styles/dx-styles/commit/ad66d89c648c3128a5b7abcf1e8545553381a35d) Thanks [@Anber](https://github.com/Anber)! - Type style objects with `csstype` so editors complete CSS properties and values

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
  function createVariants<
    const T extends readonly string[],
    TStyle = StyleObject,
  >(
    options: T,
    styles: (option: T[number]) => TStyle,
  ): Record<T[number], TStyle>;
  ```

### Patch Changes

- [#31](https://github.com/dx-styles/dx-styles/pull/31) [`7e2ff15`](https://github.com/dx-styles/dx-styles/commit/7e2ff15b44867ce79aa65c83b8c7664e6dc937c8) Thanks [@Anber](https://github.com/Anber)! - Update WyW dependencies to the latest 2.4.x releases and refresh starter example locks so their npm audits pass.

  The newer WyW transform also removes a few recently documented engine workarounds: inline
  `:global(...)` animation values now emit valid global animation references, forced `execute`
  transforms keep the side-effect import that carries cross-file `@keyframes` CSS, and explain
  metadata now carries rule records directly.

## 1.3.0

### Minor Changes

- [#23](https://github.com/dx-styles/dx-styles/pull/23) [`b7d94d3`](https://github.com/dx-styles/dx-styles/commit/b7d94d3ba78b7fa463a352cc0ef1a75787020efc) Thanks [@Anber](https://github.com/Anber)! - `createVar()` now resolves statically at build time. The processor ships a
  wyw-in-js manifest with `css-var-call` semantics: a private var's value form
  is a pure function of its hashed slug (`var(--<hash>)`) with zero call
  inputs, so files that declare or import private vars no longer drag their
  modules into build-time evaluation. Output is unchanged.

- [#24](https://github.com/dx-styles/dx-styles/pull/24) [`ef3e9e3`](https://github.com/dx-styles/dx-styles/commit/ef3e9e378447cf64bd9237158b1b5db6e2e62963) Thanks [@Anber](https://github.com/Anber)! - `css()` and `createTheme()` now resolve statically at build time through
  wyw-in-js `preeval-call` manifests backed by this package's own preeval
  runtime. Files that define or import css results — including css-in-css
  composition chains, same-file and cross-file — no longer execute modules
  during evaluation, while eval-domain semantics (descriptor values,
  composition, diagnostics) stay byte-identical because the engine calls the
  same preeval functions the eval path uses. Requires `@wyw-in-js/transform`
  ^2.3.0.

- [#21](https://github.com/dx-styles/dx-styles/pull/21) [`0868003`](https://github.com/dx-styles/dx-styles/commit/0868003f37263e97393848a733f187c1bf3c6098) Thanks [@Anber](https://github.com/Anber)! - `createTokenContract()` now resolves statically at build time. The processor
  ships a wyw-in-js manifest with `token-contract-call` semantics, so files
  that import a token contract read its value without executing the contract
  module (or its dependency graph) during evaluation — consumers like `css()`
  and `createTheme()` receive the contract as a static input. Leaf naming is
  unchanged, and non-static shapes or prefixes keep falling back to the eval
  path with identical output. Requires `@wyw-in-js/transform` ^2.2.0; the
  `@wyw-in-js/*` dependency floors are bumped accordingly.

## 1.2.0

### Minor Changes

- [#15](https://github.com/dx-styles/dx-styles/pull/15) [`87e87f8`](https://github.com/dx-styles/dx-styles/commit/87e87f8aabe79147dc36e03f8c9b050e95da75a8) Thanks [@Anber](https://github.com/Anber)! - Add `splitRecipeProps` and `splitSlotRecipeProps` for separating variant selections from component
  props, plus `RecipeVariantProps` for deriving the accepted variant prop type from a recipe.

### Patch Changes

- [#17](https://github.com/dx-styles/dx-styles/pull/17) [`9c6644f`](https://github.com/dx-styles/dx-styles/commit/9c6644fb1266fb7b4fe329658b25cf4a4b742cb7) Thanks [@Anber](https://github.com/Anber)! - Update WyW dependencies to their latest compatible versions and allow compatible minor updates.

## 1.1.0

### Minor Changes

- [#1](https://github.com/dx-styles/dx-styles/pull/1) [`c3879d5`](https://github.com/dx-styles/dx-styles/commit/c3879d52611baeed239321d2d28070a8b0c4d11b) Thanks [@Anber](https://github.com/Anber)! - Readable non-minified recipe class names, modern prefixer guidance, and accurate class-naming docs.
  - `recipe()`/`slotRecipe()` scoped class names are now human-readable when `minifyClassNames` is
    off: `button_bhhycyd__appearance-primary`, `button_bhhycyd__compound-0`,
    `field_x1__root-size-md` instead of length-prefixed hex segments
    (`button_bhhycyd__7_76617269616e74__…`). Names stay deterministic across builds and machines;
    labels that sanitize to the same string (or to nothing) deterministically fall back to the tuple
    hash, so collision resistance is unchanged. **Minified class names are byte-identical to
    1.0.0** — production output does not change. If tests snapshot non-minified CSS or select by the
    old hex class names, regenerate those snapshots/selectors.
  - Docs now configure `wyw({ prefixer: false })`: WyW's built-in stylis prefixer is on by default
    and emits IE-era `-ms-`/`-webkit-` expansions (for example `display: -ms-grid`) that modern
    targets never read. Consumers who support older browsers should generate prefixes from their
    browserslist config (for example lightningcss) instead.
  - `docs/wyw-integration.md` no longer claims a `dxs_` class prefix in package output: extracted
    names come from WyW's slug generation (`{displayName}_{slug}`), while `dxs_` only marks
    build-internal preeval references (visible in explain manifests) and the
    `dx-styles/test-support` runtime mocks.

### Patch Changes

- [#8](https://github.com/dx-styles/dx-styles/pull/8) [`d9eb5e4`](https://github.com/dx-styles/dx-styles/commit/d9eb5e4f277c219a1ec992d95758c9c3b2cc5881) Thanks [@Anber](https://github.com/Anber)! - Fail the build when a `css()`/`recipe()` result leaks into a style object instead of silently
  emitting garbage CSS.

  Interpolating a class value into a selector key (``css({ [`.${parent} &`]: … })``), nesting a
  `css()` result as a style value (`css({ "&:hover": parent })`), or passing a
  `recipe()`/`slotRecipe()`/`createTheme()` result as a `css()` part previously serialized the
  build-time descriptor straight into the stylesheet (`.[object Object] .child_x1a2b3c{…}`,
  `.child_x1a2b3c:hover __dxStyles{…}`) — surfacing, at best, as a downstream minifier syntax error.
  All three shapes now fail static extraction and the runtime fallback with a clear diagnostic:
  class values cannot be interpolated into selector keys. Group coordinated elements with
  `slotRecipe()`, or target a literal class or data-attribute selector you own.

## 1.0.0

### Major Changes

- Initial public release of dx-styles with zero-runtime CSS extraction, typed recipes, slot recipes, token contracts, themes, runtime CSS variable assignment, WyW processors, documentation, and a site.
