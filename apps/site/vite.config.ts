import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import wyw from "@wyw-in-js/vite";
import { defineConfig } from "vite";

const workspaceRoot = resolve(__dirname, "..", "..");

const dxStylesProcessorByTag: Record<string, string> = {
  css: "css",
  recipe: "recipe",
  slotRecipe: "slotRecipe",
  createTheme: "createTheme",
  createTokenContract: "createTokenContract",
  createVar: "createVar",
};

export default defineConfig({
  root: __dirname,
  plugins: [
    react(),
    wyw({
      displayName: true,
      preserveCssPaths: true,
      tagResolver: (source: string, tag: string): string | null => {
        if (source !== "dx-styles") {
          return null;
        }

        const processor = dxStylesProcessorByTag[tag];

        return processor ? resolve(workspaceRoot, "processors", `${processor}.js`) : null;
      },
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
