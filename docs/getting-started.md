# Getting Started

Install the package and configure WyW extraction in the application or library build that consumes
it.

```sh
bun add dx-styles
bun add -d @wyw-in-js/vite @babel/preset-typescript
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
      babelOptions: {
        presets: ["@babel/preset-typescript"],
      },
      processors: {
        dxStyles: {
          minifyClassNames: false,
        },
      },
    }),
  ],
});
```

The generated CSS is emitted by the build pipeline. Application code imports JavaScript modules in
the usual way and receives class names at runtime.
