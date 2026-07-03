# WyW Integration

`dx-styles` ships WyW processors through package metadata. Consumers configure the WyW plugin and
import extracted APIs from the package root.

```ts
import wyw from "@wyw-in-js/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    wyw({
      babelOptions: {
        presets: ["@babel/preset-typescript"],
      },
      displayName: true,
      processors: {
        dxStyles: {
          minifyClassNames: false,
        },
      },
    }),
  ],
});
```

The processor option namespace is `dxStyles`.

The public entrypoints are:

- `dx-styles`
- `dx-styles/runtime`
- `dx-styles/preeval-runtime`

The `dxs_` class prefix is part of the package output and remains stable across regular builds.
