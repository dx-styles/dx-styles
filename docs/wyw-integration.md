# WyW Integration

`dx-styles` ships WyW processors through package metadata. Consumers configure the WyW plugin and
import extracted APIs from the package root.

```ts
import wyw from "@wyw-in-js/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    wyw({
      displayName: true,
      prefixer: false,
      processors: {
        dxStyles: {
          minifyClassNames: false,
        },
      },
    }),
  ],
});
```

The processor option namespace is `dxStyles`. `prefixer: false` disables WyW's built-in stylis
prefixer, which targets legacy IE-era browsers (see [Getting Started](./getting-started.md)).

The public entrypoints are:

- `dx-styles`
- `dx-styles/runtime`
- `dx-styles/preeval-runtime`

Extracted class names come from WyW's slug generation: with `displayName: true` they read as
`{displayName}_{slug}` (for example `button_bhhycyd`), and recipe/slot recipe entries append
readable scoped suffixes such as `button_bhhycyd__appearance-primary` (collapsed to short hashes
with `minifyClassNames: true`). For an unchanged source tree the names are deterministic across
rebuilds and machines.

The `dxs_` prefix never appears in extracted CSS. It marks class names composed outside
extraction: build-internal preeval references (visible in explain manifests) and the
`dx-styles/test-support` runtime mocks.
