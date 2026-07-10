# Getting Started

Install the package and configure WyW extraction in the application or library build that consumes
it.

```sh
bun add dx-styles
bun add -d @wyw-in-js/vite
```

Use the package root for authoring APIs:

```ts
import { css } from "dx-styles";

export const root = css({
  display: "grid",
  gap: "12px",
});
```

For Vite, add the WyW plugin. Processor options for this package live under the `dxStyles`
namespace.

```ts
import wyw from "@wyw-in-js/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    wyw({
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

Set `prefixer: false`: WyW's built-in stylis prefixer is on by default and emits legacy IE-era
expansions (for example `display: -ms-grid`) that modern browsers never read. If you still need
vendor prefixes for older targets, generate them from your browserslist config instead — for
example Vite's `css: { transformer: "lightningcss" }` with `browserslistToTargets` — so only the
prefixes your targets actually require are emitted.

The generated CSS is emitted by the build pipeline. Application code imports JavaScript modules in
the usual way and receives class names at runtime.
