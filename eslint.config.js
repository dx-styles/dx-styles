import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

const typedTypeScriptConfigs = tseslint.configs.recommendedTypeChecked.map((config) => ({
  ...config,
  files: ["**/*.{ts,tsx}"],
}));

export default defineConfig([
  globalIgnores([
    ".changeset",
    ".git",
    ".tmp",
    "apps/site/dist",
    "dist",
    "examples",
    "node_modules",
    "coverage",
    "preeval-runtime.d.ts",
    "preeval-runtime.js",
    "processors/*.d.ts",
    "processors/*.js",
    "src/style-handle-contract.d.ts",
    "src/style-handle-contract.js",
    "style-primitives.d.ts",
    "style-primitives.js",
  ]),
  js.configs.recommended,
  ...typedTypeScriptConfigs,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2023,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        project: ["./tsconfig.eslint.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "warn",
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        {
          allowBoolean: true,
          allowNumber: true,
        },
      ],
    },
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.node,
    },
  },
]);
