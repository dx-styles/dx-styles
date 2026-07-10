# dx-styles

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
