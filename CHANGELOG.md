# dx-styles

## 1.1.1

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

## 1.0.0

### Major Changes

- Initial public release of dx-styles with zero-runtime CSS extraction, typed recipes, slot recipes, token contracts, themes, runtime CSS variable assignment, WyW processors, documentation, and a site.
