import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import wyw from "@wyw-in-js/vite";
import { defineConfig } from "vite";

const workspaceRoot = resolve(__dirname, "..", "..");

export default defineConfig({
  root: __dirname,
  plugins: [
    react(),
    wyw({
      babelOptions: {
        presets: ["@babel/preset-typescript"],
      },
      displayName: true,
      preserveCssPaths: true,
    }),
  ],
  resolve: {
    alias: [
      {
        find: /^dx-styles\/preeval-runtime$/,
        replacement: resolve(workspaceRoot, "preeval-runtime.ts"),
      },
      {
        find: /^dx-styles$/,
        replacement: resolve(workspaceRoot, "src/index.ts"),
      },
      {
        find: /^dx-styles\/runtime$/,
        replacement: resolve(workspaceRoot, "src/runtime/index.ts"),
      },
    ],
  },
  base: "./",
});
