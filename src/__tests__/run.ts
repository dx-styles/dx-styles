import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runInNewContext } from "node:vm";

import {
  type ArrayExpression,
  type AstService,
  type BaseAstNode,
  type BlockStatement,
  type BooleanLiteral,
  type CallExpression,
  expressionToCode,
  type Identifier,
  type MemberExpression,
  type NullLiteral,
  type NumericLiteral,
  type ObjectExpression,
  type ObjectProperty,
  type StringLiteral,
} from "@wyw-in-js/processor-utils";
import {
  disposeEvalBroker,
  EventEmitter,
  transform,
  TransformCacheCollection,
} from "@wyw-in-js/transform";

import { findDxStylesExplainPayload } from "../../processors/explain-schema.ts";
import { createValueNode } from "../../processors/serialization.ts";
import {
  createRecipeRuntimeDefinition,
  createSlotRecipeRuntimeDefinition,
  toCSSStyle,
} from "../../processors/shared.ts";
import {
  createDxStylesExplainIndex,
  createDxStylesExplainManifest,
  type DxStylesExplainManifest,
  formatDxStylesExplainReport,
} from "../../tooling/explain.ts";
import {
  assignVars,
  createRecipeStyleHandles,
  createSlotRecipeStyleHandles,
  createStyleHandle,
  createTheme,
  createTokenContract,
  css,
  cx,
  recipe,
  slotRecipe,
  splitRecipeProps,
  splitSlotRecipeProps,
} from "../index";
import {
  compileRuntimeRecipeDefinition,
  DX_STYLES_DESCRIPTOR_KEY,
  STYLE_HANDLE_DESCRIPTOR_KIND,
} from "../internal";
import { createRuntimeRecipe } from "../runtime";

interface PreevalRuntimeModule {
  readonly preevalCss: (...parts: readonly unknown[]) => unknown;
  readonly preevalRecipe: (config: unknown) => unknown;
}

interface StyleHandleDescriptorForTest {
  readonly className: string;
  readonly kind: typeof STYLE_HANDLE_DESCRIPTOR_KIND;
}

interface RootEntryModule {
  readonly createStyleHandle: (className: string) => object;
  readonly recipe: typeof recipe;
  readonly slotRecipe: typeof slotRecipe;
  readonly splitRecipeProps: typeof splitRecipeProps;
  readonly splitSlotRecipeProps: typeof splitSlotRecipeProps;
}

function isPreevalRuntimeModule(value: unknown): value is PreevalRuntimeModule {
  if (
    typeof value !== "object" ||
    value === null ||
    !("preevalCss" in value) ||
    !("preevalRecipe" in value)
  ) {
    return false;
  }

  return typeof value.preevalCss === "function" && typeof value.preevalRecipe === "function";
}

function isStyleHandleDescriptorForTest(value: unknown): value is StyleHandleDescriptorForTest {
  if (typeof value !== "object" || value === null || !("kind" in value)) {
    return false;
  }

  return (
    "className" in value &&
    value.kind === STYLE_HANDLE_DESCRIPTOR_KIND &&
    typeof value.className === "string"
  );
}

function isRootEntryModule(value: unknown): value is RootEntryModule {
  if (
    typeof value !== "object" ||
    value === null ||
    !("createStyleHandle" in value) ||
    !("recipe" in value) ||
    !("slotRecipe" in value) ||
    !("splitRecipeProps" in value) ||
    !("splitSlotRecipeProps" in value)
  ) {
    return false;
  }

  return (
    typeof value.createStyleHandle === "function" &&
    typeof value.recipe === "function" &&
    typeof value.slotRecipe === "function" &&
    typeof value.splitRecipeProps === "function" &&
    typeof value.splitSlotRecipeProps === "function"
  );
}

function loadPreevalRuntime(): PreevalRuntimeModule {
  const packageRequire = createRequire(import.meta.url);
  const runtimeModule: unknown = packageRequire(
    join(process.cwd(), "preeval-runtime.ts"),
  );

  assert.ok(isPreevalRuntimeModule(runtimeModule));
  return runtimeModule;
}

function resolveImport(specifier: string, importer: string): Promise<null | string> {
  try {
    const scopedRequire = createRequire(importer);
    return Promise.resolve(scopedRequire.resolve(specifier));
  } catch {
    return Promise.resolve(null);
  }
}

function assertSerializableStyleHandle(value: object, expectedClassName: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(value, DX_STYLES_DESCRIPTOR_KEY);

  if (descriptor === undefined) {
    throw new Error("Expected style handle descriptor to exist.");
  }

  assert.equal(descriptor.configurable, false);
  assert.equal(descriptor.enumerable, true);
  assert.equal(descriptor.writable, false);

  const descriptorValue: unknown = descriptor.value;
  assert.ok(isStyleHandleDescriptorForTest(descriptorValue));
  assert.equal(descriptorValue.className, expectedClassName);
  assert.equal(Object.isFrozen(descriptorValue), true);
  assert.equal(Object.isFrozen(value), true);
  assert.deepEqual(Object.keys(value), [DX_STYLES_DESCRIPTOR_KEY]);
  assert.equal(
    JSON.stringify(value),
    `{"${DX_STYLES_DESCRIPTOR_KEY}":{"className":"${expectedClassName}","kind":"${STYLE_HANDLE_DESCRIPTOR_KIND}"}}`,
  );
}

async function runWywTransform(
  source: string,
  fixtureName: string,
  options: {
    readonly outputMetadata?: boolean;
    readonly displayName?: boolean;
    readonly minifyClassNames?: boolean;
    readonly evalStrategy?: "execute" | "hybrid" | "static";
    readonly eventEmitter?: EventEmitter;
  } = {},
) {
  const filename = isAbsolute(fixtureName)
    ? fixtureName
    : join(process.cwd(), "src/__tests__/fixtures", fixtureName);
  const cache = new TransformCacheCollection();

  try {
    return await transform(
      {
        cache,
        eventEmitter: options.eventEmitter,
        options: {
          filename,
          root: process.cwd(),
          pluginOptions: {
            configFile: false,
            displayName: options.displayName ?? true,
            ...(options.evalStrategy === undefined
              ? {}
              : { eval: { strategy: options.evalStrategy } }),
            importOverrides: {
              "./preeval-runtime.js": { unknown: "allow" },
            },
            processors: { dxStyles: { minifyClassNames: options.minifyClassNames ?? false } },
            outputMetadata: options.outputMetadata ?? false,
            features: {
              happyDOM: false,
            },
          },
        },
      },
      source,
      resolveImport,
    );
  } finally {
    disposeEvalBroker(cache);
  }
}

function extractCssSelectors(cssText: string): string[] {
  return Array.from(cssText.matchAll(/\.([^{\s,]+)\s*\{/gu), (match) => match[1]);
}

function runSharedLibraryBuild(packageRoot: string) {
  execFileSync("bunx", ["vite", "build", "--config", join(process.cwd(), "vite-lib-build.ts")], {
    cwd: packageRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      SHARED_LIB_BUILD_PACKAGE_ROOT: packageRoot,
    },
  });
}

async function linkDxStylesFixtureDependency(packageRoot: string) {
  const dxStylesPackageRoot = process.cwd();
  const modulesRoot = join(packageRoot, "node_modules");

  await mkdir(modulesRoot, { recursive: true });
  await symlink(dxStylesPackageRoot, join(modulesRoot, "dx-styles"), "junction");
}

function resolvePackageExportWithNode(
  packageRoot: string,
  specifier: string,
  conditions: readonly string[],
): string {
  const nodeBinary = process.env.WYW_NODE_BINARY ?? "node";
  const importer = join(packageRoot, "src", "index.ts");
  const script = `
    const fs = require("node:fs");
    const path = require("node:path");
    const Module = require("node:module");
    const input = JSON.parse(fs.readFileSync(0, "utf8"));
    const parent = {
      id: input.importer,
      filename: input.importer,
      paths: Module._nodeModulePaths(path.dirname(input.importer)),
    };
    const options = input.conditions.length > 0
      ? { conditions: new Set(input.conditions) }
      : undefined;
    process.stdout.write(Module._resolveFilename(input.specifier, parent, false, options));
  `;

  return execFileSync(nodeBinary, ["-e", script], {
    encoding: "utf8",
    input: JSON.stringify({ conditions, importer, specifier }),
  }).trim();
}

async function collectFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        return collectFiles(fullPath);
      }

      return [fullPath];
    }),
  );

  return nestedFiles.flat();
}

async function importBuiltModule<TModule extends object>(
  packageRoot: string,
  relativeModulePath: string,
  isModule: (value: unknown) => value is TModule,
): Promise<TModule> {
  const distRoot = join(packageRoot, "dist");
  const evalRoot = join(packageRoot, ".tmp-eval");
  const dxStylesEntryPath = resolve(process.cwd(), "dist/index.js");
  const dxStylesRuntimeEntryPath = resolve(process.cwd(), "dist/runtime/index.js");

  await rm(evalRoot, { force: true, recursive: true });
  await mkdir(evalRoot, { recursive: true });

  const distFiles = await collectFiles(distRoot);

  await Promise.all(
    distFiles
      .filter((filePath) => filePath.endsWith(".js"))
      .map(async (modulePath) => {
        const relativePath = relative(distRoot, modulePath);
        const targetPath = resolve(evalRoot, relativePath);
        const toRelativeModuleSpecifier = (targetFilePath: string) => {
          const relativePathFromTarget = relative(dirname(targetPath), targetFilePath).replaceAll(
            "\\",
            "/",
          );
          return relativePathFromTarget.startsWith(".")
            ? relativePathFromTarget
            : `./${relativePathFromTarget}`;
        };
        const sanitizedCode = (await readFile(modulePath, "utf8"))
          .replace(/^import\s*["'][^"']+\.css["'];\n?/gmu, "")
          .replace(
            /from\s*["']dx-styles\/runtime["']/gmu,
            `from ${JSON.stringify(toRelativeModuleSpecifier(dxStylesRuntimeEntryPath))}`,
          )
          .replace(
            /from\s*["']dx-styles["']/gmu,
            `from ${JSON.stringify(toRelativeModuleSpecifier(dxStylesEntryPath))}`,
          )
          .replace(/\n?\/\/# sourceMappingURL=.*$/gmu, "\n");

        await mkdir(dirname(targetPath), { recursive: true });
        await writeFile(targetPath, sanitizedCode);
      }),
  );

  const moduleNamespace: unknown = await import(
    `${pathToFileURL(join(evalRoot, relativeModulePath)).href}?t=${Date.now()}-${Math.random()}`
  );
  assert.ok(isModule(moduleNamespace));
  return moduleNamespace;
}

interface DxStylesPackageJson {
  readonly exports: Record<
    string,
    {
      readonly bun?: string;
      readonly default?: string;
      readonly import?: string;
      readonly require?: string;
      readonly types?: string;
      readonly "wyw-in-js"?: string;
    }
  >;
  readonly files: readonly string[];
  readonly "wyw-in-js": {
    readonly tags: Record<string, string>;
  };
}

interface WorkspaceTsConfig {
  readonly compilerOptions?: {
    readonly paths?: Record<string, readonly string[]>;
  };
}

interface BuiltClassNameModule {
  readonly className: string;
}

interface BuiltBaseModule {
  readonly base: string;
}

interface WywTestDiagnostic {
  readonly category: string;
  readonly filename: string;
  readonly message: string;
  readonly severity: string;
  readonly start: unknown;
}

function expectPresent<TValue>(value: TValue, message: string): NonNullable<TValue> {
  if (value == null) {
    throw new Error(message);
  }

  return value;
}

class StyleInstance {
  readonly color: string;

  constructor(color: string) {
    this.color = color;
  }
}

function evaluateInNewContext(source: string): unknown {
  return runInNewContext(source);
}

function createTestIdentifier(name: string): Identifier {
  return { name, type: "Identifier" };
}

function createTestAstService(): AstService {
  return {
    addDefaultImport(_source, nameHint = "defaultImport") {
      return createTestIdentifier(nameHint);
    },
    addNamedImport(name, _source, nameHint = name) {
      return createTestIdentifier(nameHint);
    },
    arrayExpression(elements): ArrayExpression {
      return { elements, type: "ArrayExpression" };
    },
    arrowFunctionExpression(params, body) {
      return { body, params, type: "ArrowFunctionExpression" };
    },
    blockStatement(body: BaseAstNode[]): BlockStatement {
      return { body, type: "BlockStatement" };
    },
    booleanLiteral(value): BooleanLiteral {
      return { type: "BooleanLiteral", value };
    },
    callExpression(callee, args): CallExpression {
      return { arguments: args, callee, type: "CallExpression" };
    },
    identifier: createTestIdentifier,
    memberExpression(object, property, computed = false): MemberExpression {
      return { computed, object, property, type: "MemberExpression" };
    },
    nullLiteral(): NullLiteral {
      return { type: "NullLiteral" };
    },
    numericLiteral(value): NumericLiteral {
      return { type: "NumericLiteral", value };
    },
    objectExpression(properties): ObjectExpression {
      return { properties, type: "ObjectExpression" };
    },
    objectProperty(key, value): ObjectProperty {
      return { key, type: "ObjectProperty", value };
    },
    stringLiteral(value): StringLiteral {
      return { type: "StringLiteral", value };
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringRecordForTest(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === "string");
}

function isRuntimeVariantClassMapForTest(
  value: unknown,
): value is Record<string, Record<string, string>> {
  return isRecord(value) && Object.values(value).every(isStringRecordForTest);
}

function isRuntimeRecipeDefinitionForTest(
  value: unknown,
): value is Parameters<typeof createRuntimeRecipe>[0] {
  return (
    isRecord(value) &&
    (value.baseClassName === undefined || typeof value.baseClassName === "string") &&
    Array.isArray(value.compoundVariants) &&
    value.compoundVariants.every(
      (entry) =>
        isRecord(entry) &&
        typeof entry.className === "string" &&
        isStringRecordForTest(entry.matches),
    ) &&
    isStringRecordForTest(value.defaultVariants) &&
    Array.isArray(value.variantOrder) &&
    value.variantOrder.every((entry) => typeof entry === "string") &&
    isRuntimeVariantClassMapForTest(value.variants)
  );
}

function isWywTestDiagnostic(value: unknown): value is WywTestDiagnostic {
  return (
    isRecord(value) &&
    typeof value.category === "string" &&
    typeof value.filename === "string" &&
    typeof value.message === "string" &&
    typeof value.severity === "string" &&
    "start" in value
  );
}

function readWywTestDiagnostics(value: unknown): WywTestDiagnostic[] {
  if (value === undefined) {
    return [];
  }

  assert.ok(Array.isArray(value));
  assert.ok(value.every(isWywTestDiagnostic));
  return value;
}

function supportsWywOutputMetadata(): boolean {
  const packageRequire = createRequire(import.meta.url);
  const wywTransformModule: unknown = packageRequire("@wyw-in-js/transform");

  return (
    isRecord(wywTransformModule) && typeof wywTransformModule.createTransformManifest === "function"
  );
}

function isStylePartObject(value: unknown): value is Parameters<typeof css>[0] {
  return isRecord(value);
}

function isBuiltClassNameModule(value: unknown): value is BuiltClassNameModule {
  return isRecord(value) && typeof value.className === "string";
}

function isBuiltBaseModule(value: unknown): value is BuiltBaseModule {
  return isRecord(value) && typeof value.base === "string";
}

function readOwnStringProperty(value: object, key: string): string {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);

  assert.ok(descriptor, `Expected own property "${key}".`);
  const propertyValue: unknown = descriptor.value;
  if (typeof propertyValue !== "string") {
    throw new Error(`Expected own property "${key}" to be a string.`);
  }
  return propertyValue;
}

function isDxStylesPackageJson(value: unknown): value is DxStylesPackageJson {
  if (!isRecord(value)) {
    return false;
  }

  if (!Array.isArray(value.files) || !value.files.every((entry) => typeof entry === "string")) {
    return false;
  }

  if (!isRecord(value.exports)) {
    return false;
  }

  if (
    !isRecord(value["wyw-in-js"]) ||
    !isRecord(value["wyw-in-js"].tags) ||
    !Object.values(value["wyw-in-js"].tags).every((entry) => typeof entry === "string")
  ) {
    return false;
  }

  return Object.values(value.exports).every(
    (entry) =>
      isRecord(entry) &&
      (entry.bun === undefined || typeof entry.bun === "string") &&
      (entry.default === undefined || typeof entry.default === "string") &&
      (entry.import === undefined || typeof entry.import === "string") &&
      (entry.require === undefined || typeof entry.require === "string") &&
      (entry.types === undefined || typeof entry.types === "string") &&
      (entry["wyw-in-js"] === undefined || typeof entry["wyw-in-js"] === "string"),
  );
}

function testRuntimeHelpers() {
  assert.equal(cx("alpha beta", undefined, "beta gamma", false, "alpha"), "alpha beta gamma");

  assert.throws(
    // @ts-expect-error Intentional runtime validation check.
    () => css("foo"),
    /previously declared css\(\) results/u,
  );

  assert.throws(
    // @ts-expect-error Intentional runtime validation check.
    () => css(123),
    /style objects and previously declared css\(\) results/u,
  );

  assert.throws(
    // @ts-expect-error Intentional runtime validation check.
    () => css(new Date()),
    /style objects and previously declared css\(\) results/u,
  );

  assert.throws(() => {
    // @ts-expect-error Intentional runtime validation check.
    return css(new String("foo"));
  }, /style objects and previously declared css\(\) results/u);

  assert.throws(() => {
    // @ts-expect-error Intentional runtime validation check.
    return css(new Number(1));
  }, /style objects and previously declared css\(\) results/u);

  assert.throws(
    // @ts-expect-error Intentional runtime validation check.
    () => css(new StyleInstance("red")),
    /style objects and previously declared css\(\) results/u,
  );

  assert.throws(
    () => css({ __dxStyles: { kind: "css" } }),
    /style objects and previously declared css\(\) results/u,
  );

  assert.throws(
    () => css({ __dxStyles: { kind: "css", style: undefined } }),
    /style objects and previously declared css\(\) results/u,
  );

  assert.match(css({ $rtl: true, paddingLeft: "4px" }), /^dxs_/u);

  const nestedStyleHandle = createStyleHandle("public_button_root");
  assert.throws(
    () =>
      css({
        // @ts-expect-error Intentional runtime validation check.
        color: nestedStyleHandle,
      }),
    /style property "color" cannot reference a style handle/u,
  );

  assert.throws(
    () =>
      css({
        // @ts-expect-error Intentional runtime validation check.
        color: [nestedStyleHandle],
      }),
    /style property "color" cannot use non-primitive array values/u,
  );

  // Interpolating an object into a selector key stringifies it to
  // "[object Object]"; the same guard protects build-time extraction.
  assert.throws(
    () =>
      css({
        ".[object Object] &": {
          color: "blue",
        },
      }),
    /class values cannot be interpolated into selector keys/u,
  );

  assert.throws(
    () =>
      css({
        "&:hover": {
          __dxStyles: {},
        },
      }),
    /style property "&:hover" cannot embed a css\(\)\/recipe\(\)\/createTheme\(\) result/u,
  );

  assert.throws(
    () =>
      css({
        $rtl: false,
        color: "blue",
      }),
    /dx-styles \$rtl marker only accepts true\./u,
  );

  assert.throws(
    () =>
      css({
        color: true,
      }),
    /dx-styles style property "color" cannot be true/u,
  );

  const crossRealmStyle = evaluateInNewContext('({ color: "blue" })');
  assert.ok(isStylePartObject(crossRealmStyle));
  assert.equal(css(crossRealmStyle), css({ color: "blue" }));

  assert.throws(
    // @ts-expect-error Intentional runtime validation check.
    () => createTokenContract({ color: { accent: null } }),
    /requires a non-empty prefix/u,
  );

  const contract = createTokenContract(
    {
      color: {
        accent: null,
        muted: null,
      },
      size: {
        rowHeight: null,
      },
    },
    { prefix: "runtime-contract" },
  );

  assert.deepEqual(
    assignVars(contract, {
      color: {
        accent: "#f00",
      },
      size: {
        rowHeight: "32px",
      },
    }),
    {
      [contract.color.accent.slice(4, -1)]: "#f00",
      [contract.size.rowHeight.slice(4, -1)]: "32px",
    },
  );

  const specialContract = createTokenContract(Object.fromEntries([["__proto__", null]]), {
    prefix: "runtime-special-contract",
  });
  const specialContractValue = readOwnStringProperty(specialContract, "__proto__");

  assert.equal(specialContractValue, "var(--runtime-special-contract-__proto__)");
  assert.deepEqual(assignVars(specialContract, Object.fromEntries([["__proto__", "#f00"]])), {
    "--runtime-special-contract-__proto__": "#f00",
  });

  assert.match(
    createTheme(
      createTokenContract(
        {
          surface: {
            default: null,
          },
        },
        { prefix: "theme-contract" },
      ),
      {
        surface: {
          default: "#fff",
        },
      },
    ),
    /^dxt_/u,
  );

  const runtimeThemeContract = createTokenContract(
    {
      color: {
        accent: null,
        muted: null,
      },
    },
    { prefix: "runtime-theme" },
  );
  const partialThemeValues = {
    color: {
      accent: "#f00",
    },
  };

  assert.throws(() => {
    // @ts-expect-error Intentional runtime validation check.
    return createTheme(runtimeThemeContract, partialThemeValues);
  }, /Missing value for "muted"\./u);

  assert.throws(() => {
    // @ts-expect-error Intentional runtime validation check.
    return createTheme(runtimeThemeContract, "oops");
  }, /theme values must be an object\./u);

  const checkbox = slotRecipe({
    base: {
      control: {
        display: "inline-flex",
      },
      root: {
        alignItems: "center",
        display: "inline-flex",
      },
    },
    defaultVariants: {
      size: "md",
    },
    slots: ["root", "control", "label"] as const,
    variants: {
      size: {
        md: {
          control: {
            width: 16,
          },
          label: {
            fontSize: 14,
          },
        },
        sm: {
          control: {
            width: 12,
          },
          label: {
            fontSize: 12,
          },
        },
      },
    },
  });

  const medium = checkbox();
  const small = checkbox({ size: "sm" });

  assert.deepEqual(Object.keys(medium), ["root", "control", "label"]);
  assert.match(medium.root, /^dxs_/u);
  assert.match(medium.control, /^dxs_/u);
  assert.match(medium.label, /^dxs_/u);
  assert.notEqual(small.control, medium.control);
  assert.equal(small.root, medium.root);

  const runtimeRecipe = createRuntimeRecipe(
    compileRuntimeRecipeDefinition({
      base: {
        display: "inline-flex",
      },
      defaultVariants: {
        size: "md",
      },
      variants: {
        size: {
          md: {
            width: 16,
          },
          sm: {
            width: 12,
          },
        },
      },
    }),
  );

  assert.equal(runtimeRecipe({ size: undefined }), runtimeRecipe());

  const specialAxis = "__proto__";
  const recipeWithSpecialAxis = recipe({
    compoundVariants: [
      {
        [specialAxis]: "active",
        css: {
          fontWeight: 700,
        },
      },
    ],
    defaultVariants: {
      [specialAxis]: "active",
    },
    variants: {
      [specialAxis]: {
        active: {
          color: "blue",
        },
      },
    },
  });
  const recipeWithSpecialAxisClassName = recipeWithSpecialAxis();

  assert.equal(recipeWithSpecialAxisClassName.split(/\s+/u).filter(Boolean).length, 2);
  assert.equal(recipeWithSpecialAxisClassName, recipeWithSpecialAxis({ [specialAxis]: "active" }));

  const slotRecipeWithSpecialSlot = slotRecipe({
    base: {
      [specialAxis]: {
        color: "blue",
      },
    },
    slots: [specialAxis] as const,
  });
  const slotRecipeWithSpecialSlotClassNames = slotRecipeWithSpecialSlot();

  assert.equal(Object.hasOwn(slotRecipeWithSpecialSlotClassNames, "__proto__"), true);
  assert.match(readOwnStringProperty(slotRecipeWithSpecialSlotClassNames, "__proto__"), /^dxs_/u);

  assert.throws(() => {
    return recipe({
      // @ts-expect-error Intentional runtime validation check.
      base: 0,
      variants: {},
    });
  }, /style objects and previously declared css\(\) results/u);

  assert.throws(() => {
    return recipe({
      variants: {
        size: {
          md: {
            color: "blue",
          },
        },
      },
      compoundVariants: [
        {
          // @ts-expect-error Intentional runtime validation check.
          size: 123,
          css: {
            color: "blue",
          },
        },
      ],
    });
  }, /compound variant #0 (?:must include css and string match values|requires string match values)/u);

  assert.throws(() => {
    return recipe({
      variants: {
        size: {
          md: {
            color: "blue",
          },
        },
      },
      compoundVariants: [
        {
          // @ts-expect-error Intentional runtime validation check.
          siz: "md",
          css: {
            color: "blue",
          },
        },
      ],
    });
  }, /unknown variant axis "siz"/u);

  assert.throws(() => {
    return slotRecipe({
      slots: ["root"] as const,
      base: {
        // @ts-expect-error Intentional runtime validation check.
        root: 0,
      },
    });
  }, /style objects and previously declared css\(\) results/u);

  assert.throws(() => {
    return slotRecipe({
      slots: ["root"] as const,
      base: {
        // @ts-expect-error Intentional runtime validation check.
        root: new Date(),
      },
    });
  }, /style objects and previously declared css\(\) results/u);

  assert.throws(() => {
    return slotRecipe({
      slots: ["root"] as const,
      base: {
        // @ts-expect-error Intentional runtime validation check.
        body: {
          color: "blue",
        },
      },
    });
  }, /slotRecipe\(\) base references unknown slot "body"/u);

  assert.throws(() => {
    return slotRecipe({
      slots: ["root"] as const,
      variants: {
        size: {
          md: {
            // @ts-expect-error Intentional runtime validation check.
            body: {
              color: "blue",
            },
          },
        },
      },
    });
  }, /slotRecipe\(\) variant "size\.md" references unknown slot "body"/u);

  assert.throws(() => {
    return slotRecipe({
      compoundVariants: [
        {
          css: {
            // @ts-expect-error Intentional runtime validation check.
            body: {
              color: "blue",
            },
          },
          size: "md",
        },
      ],
      slots: ["root"] as const,
      variants: {
        size: {
          md: {
            root: {
              color: "blue",
            },
          },
        },
      },
    });
  }, /slotRecipe\(\) compound variant #0 css references unknown slot "body"/u);
}

function testRuntimeStyleHandles() {
  const button = recipe({
    base: {
      color: "red",
    },
    variants: {
      size: {
        small: {
          fontSize: "12px",
        },
      },
    },
  });
  const buttonHandles = createRecipeStyleHandles(button);
  const rootClassName = button().split(/\s+/u)[0];

  assertSerializableStyleHandle(buttonHandles.root, rootClassName);
  assert.equal(css(buttonHandles.root), rootClassName);
  const extendedButtonClassName = css(buttonHandles.root, { minHeight: "24px" });
  const extendedButtonTokens = extendedButtonClassName.split(/\s+/u);
  assert.equal(extendedButtonClassName.startsWith(`${rootClassName} `), true);

  const nestedButtonClassName = css(extendedButtonClassName, { borderWidth: "1px" });
  const nestedButtonTokens = nestedButtonClassName.split(/\s+/u);
  assert.equal(nestedButtonClassName.startsWith(`${rootClassName} `), true);
  assert.equal(nestedButtonTokens.includes(extendedButtonTokens[1]), false);

  const checkbox = slotRecipe({
    slots: ["root", "control"] as const,
    base: {
      root: {
        display: "inline-flex",
      },
      control: {
        width: "16px",
      },
    },
  });
  const checkboxHandles = createSlotRecipeStyleHandles(checkbox);
  const checkboxClassNames = checkbox();
  const checkboxRootHandle = expectPresent(
    checkboxHandles.slots.root,
    "Expected checkbox root handle.",
  );
  const checkboxControlHandle = expectPresent(
    checkboxHandles.slots.control,
    "Expected checkbox control handle.",
  );

  assertSerializableStyleHandle(checkboxRootHandle, checkboxClassNames.root);
  assert.equal(css(checkboxRootHandle), checkboxClassNames.root);
  assert.equal(css(checkboxControlHandle), checkboxClassNames.control);

  const unstyledSlotRecipe = slotRecipe({
    slots: ["root", "control", "measure"] as const,
    base: {
      root: {
        display: "inline-flex",
      },
      control: {
        width: "16px",
      },
    },
    variants: {
      size: {
        small: {
          measure: {
            opacity: 0,
          },
        },
      },
    },
  });
  const unstyledHandles = createSlotRecipeStyleHandles(unstyledSlotRecipe);

  assert.equal("measure" in unstyledHandles.slots, false);
  assert.ok("measure" in unstyledHandles.variants.size.small);

  const externalHandle = createStyleHandle("external_root");
  assertSerializableStyleHandle(externalHandle, "external_root");

  const externalWrapperClassName = css(externalHandle, { color: "blue" });
  const nestedExternalWrapperClassName = css(externalWrapperClassName, {
    backgroundColor: "white",
  });

  assert.equal(nestedExternalWrapperClassName.startsWith("external_root "), true);
}

function testRecipePropSplitting() {
  const button = recipe({
    variants: {
      appearance: {
        ghost: {
          color: "blue",
        },
        primary: {
          color: "white",
        },
      },
      size: {
        large: {
          minHeight: 40,
        },
        small: {
          minHeight: 28,
        },
      },
    },
  });
  const metadataKey = Symbol("metadata");
  const props = {
    appearance: "ghost" as const,
    className: "consumer",
    disabled: true,
    size: undefined,
    [metadataKey]: "metadata",
  };

  Object.defineProperty(props, "hidden", {
    enumerable: false,
    value: "hidden",
  });

  const { otherProps, variantProps } = splitRecipeProps(button, props);

  assert.deepEqual(variantProps, {
    appearance: "ghost",
    size: undefined,
  });
  assert.deepEqual(otherProps, {
    className: "consumer",
    disabled: true,
    [metadataKey]: "metadata",
  });
  assert.equal(Object.hasOwn(variantProps, "size"), true);
  assert.equal(Object.hasOwn(otherProps, "hidden"), false);
  assert.equal(props.appearance, "ghost");
  assert.match(button(variantProps), /^dxs_/u);

  const specialAxis = "__proto__";
  const specialRecipe = recipe({
    variants: {
      [specialAxis]: {
        active: {
          color: "blue",
        },
      },
    },
  });
  const specialProps = Object.fromEntries([
    [specialAxis, "active"],
    ["constructor", "consumer"],
  ]) as Record<typeof specialAxis, "active"> & { readonly constructor: string };
  const specialSplit = splitRecipeProps(specialRecipe, specialProps);

  assert.equal(Object.hasOwn(specialSplit.variantProps, specialAxis), true);
  assert.equal(Reflect.get(specialSplit.variantProps, specialAxis), "active");
  assert.equal(Reflect.getPrototypeOf(specialSplit.variantProps), Object.prototype);
  assert.deepEqual(specialSplit.otherProps, { constructor: "consumer" });

  const field = slotRecipe({
    slots: ["root", "control"] as const,
    variants: {
      density: {
        compact: {
          control: {
            minHeight: 28,
          },
        },
        comfortable: {
          control: {
            minHeight: 36,
          },
        },
      },
    },
  });
  const splitFieldProps = splitSlotRecipeProps(field, {
    density: "compact",
    id: "email",
  });

  assert.deepEqual(splitFieldProps.variantProps, { density: "compact" });
  assert.deepEqual(splitFieldProps.otherProps, { id: "email" });
  assert.match(field(splitFieldProps.variantProps).control, /^dxs_/u);

  assert.throws(() => {
    splitRecipeProps(() => "", {});
  }, /splitRecipeProps\(\) requires a dx-styles recipe/u);
  assert.throws(() => {
    // @ts-expect-error Intentional runtime validation check.
    splitRecipeProps(button, null);
  }, /splitRecipeProps\(\) requires a props object/u);
  assert.throws(() => {
    splitSlotRecipeProps(() => ({}), {});
  }, /splitSlotRecipeProps\(\) requires a dx-styles slotRecipe/u);
}

async function testBuiltRootEntryStyleHandles() {
  const entryPath = join(process.cwd(), "dist/index.js");
  const moduleNamespace: unknown = await import(
    `${pathToFileURL(entryPath).href}?t=${Date.now()}-${Math.random()}`
  );

  assert.ok(isRootEntryModule(moduleNamespace));

  const externalHandle = moduleNamespace.createStyleHandle("public_button_root");

  assertSerializableStyleHandle(externalHandle, "public_button_root");

  const builtButton = moduleNamespace.recipe({
    variants: {
      size: {
        small: {
          minHeight: 28,
        },
      },
    },
  });
  const builtButtonProps = moduleNamespace.splitRecipeProps(builtButton, {
    id: "save",
    size: "small",
  });

  assert.deepEqual(builtButtonProps.variantProps, { size: "small" });
  assert.deepEqual(builtButtonProps.otherProps, { id: "save" });

  const builtField = moduleNamespace.slotRecipe({
    slots: ["root"] as const,
    variants: {
      density: {
        compact: {
          root: {
            minHeight: 28,
          },
        },
      },
    },
  });
  const builtFieldProps = moduleNamespace.splitSlotRecipeProps(builtField, {
    density: "compact",
    id: "email",
  });

  assert.deepEqual(builtFieldProps.variantProps, { density: "compact" });
  assert.deepEqual(builtFieldProps.otherProps, { id: "email" });
}

async function testBuiltPreevalRuntimeModule() {
  const entryPath = join(process.cwd(), "preeval-runtime.js");
  const moduleNamespace: unknown = await import(
    `${pathToFileURL(entryPath).href}?t=${Date.now()}-${Math.random()}`
  );

  assert.ok(isPreevalRuntimeModule(moduleNamespace));

  const style = Object.fromEntries([["__proto__", { color: "red" }]]);
  const preevalValue = moduleNamespace.preevalCss(style);

  assert.match(JSON.stringify(preevalValue), /"__proto__":\{"color":"red"\}/u);
}

function testPreevalRuntimeHelpers() {
  const { preevalCss, preevalRecipe } = loadPreevalRuntime();

  assert.throws(() => preevalCss("foo"), /previously declared css\(\) results/u);

  assert.throws(() => preevalCss(0), /style objects and previously declared css\(\) results/u);

  assert.throws(
    () => preevalCss(new Date()),
    /style objects and previously declared css\(\) results/u,
  );

  assert.throws(() => {
    return preevalCss(new String("foo"));
  }, /style objects and previously declared css\(\) results/u);

  assert.throws(() => {
    return preevalCss(new Number(1));
  }, /style objects and previously declared css\(\) results/u);

  assert.throws(
    () => preevalCss(new StyleInstance("red")),
    /style objects and previously declared css\(\) results/u,
  );

  assert.throws(
    () => preevalCss({ __dxStyles: { kind: "css" } }),
    /style objects and previously declared css\(\) results/u,
  );

  assert.throws(
    () => preevalCss({ __dxStyles: { kind: "css", style: undefined } }),
    /style objects and previously declared css\(\) results/u,
  );

  assert.throws(
    () => preevalCss({ ".[object Object] &": { color: "blue" } }),
    /class values cannot be interpolated into selector keys/u,
  );

  assert.throws(
    () => preevalCss({ "&:hover": preevalCss({ color: "red" }) }),
    /style property "&:hover" cannot embed a css\(\)\/recipe\(\)\/createTheme\(\) result/u,
  );

  assert.throws(
    () => preevalCss(preevalRecipe({ base: { color: "red" } })),
    /style objects and previously declared css\(\) results/u,
  );

  assert.match(JSON.stringify(preevalCss({ $rtl: true, paddingLeft: "4px" })), /\$rtl/u);

  assert.throws(
    () =>
      preevalCss({
        $noflip: false,
        color: "blue",
      }),
    /dx-styles \$noflip marker only accepts true\./u,
  );

  const crossRealmStyle = evaluateInNewContext('({ color: "blue" })');
  assert.ok(isRecord(crossRealmStyle));
  assert.deepEqual(preevalCss(crossRealmStyle), preevalCss({ color: "blue" }));
}

function testRuntimeSerializerPreservesSpecialDataProperties() {
  const astService = createTestAstService();
  const runtimeDefinition = {
    baseClassName: undefined,
    compoundVariants: [
      {
        className: "compound-class",
        matches: Object.fromEntries([["__proto__", "active"]]),
      },
    ],
    defaultVariants: Object.fromEntries([["__proto__", "active"]]),
    variantOrder: ["__proto__"],
    variants: Object.fromEntries([["__proto__", { active: "variant-class" }]]),
  };
  const runtimeDefinitionCode = expressionToCode(createValueNode(astService, runtimeDefinition));
  const decodedRuntimeDefinition = evaluateInNewContext(`(${runtimeDefinitionCode})`);

  assert.ok(isRuntimeRecipeDefinitionForTest(decodedRuntimeDefinition));

  const compoundVariant = expectPresent(
    decodedRuntimeDefinition.compoundVariants[0],
    "Expected serialized compound variant.",
  );

  assert.equal(Object.hasOwn(decodedRuntimeDefinition, "baseClassName"), true);
  assert.equal(Object.hasOwn(decodedRuntimeDefinition.defaultVariants, "__proto__"), true);
  assert.equal(Object.hasOwn(decodedRuntimeDefinition.variants, "__proto__"), true);
  assert.equal(Object.hasOwn(compoundVariant.matches, "__proto__"), true);
  assert.equal(createRuntimeRecipe(decodedRuntimeDefinition)(), "variant-class compound-class");

  const undefinedValueCode = expressionToCode(
    createValueNode(astService, { entries: [undefined], field: undefined }),
  );
  const decodedUndefinedValue = evaluateInNewContext(`(${undefinedValueCode})`);

  assert.ok(isRecord(decodedUndefinedValue));
  assert.equal(Object.hasOwn(decodedUndefinedValue, "field"), true);
  assert.equal(decodedUndefinedValue.field, undefined);
  assert.ok(Array.isArray(decodedUndefinedValue.entries));
  assert.equal(Object.hasOwn(decodedUndefinedValue.entries, "0"), true);
  assert.equal(decodedUndefinedValue.entries[0], undefined);
}

function testStyleObjectsPreserveSpecialDataProperties() {
  const { preevalCss } = loadPreevalRuntime();
  const style = Object.fromEntries([["__proto__", { color: "red" }]]);
  const preevalValue = preevalCss(style);

  assert.match(JSON.stringify(preevalValue), /"__proto__":\{"color":"red"\}/u);
  assert.equal(toCSSStyle(style), "__proto__{color:red;}");
}

function testProcessorRuntimeDefinitionsPreserveSpecialMatches() {
  const specialAxis = "__proto__";
  const runtimeDefinition = createRecipeRuntimeDefinition(
    "processor-special",
    {
      compoundVariants: [
        {
          [specialAxis]: "active",
          css: {
            fontWeight: 700,
          },
        },
      ],
      variants: {
        [specialAxis]: {
          active: {
            color: "blue",
          },
        },
      },
    },
    false,
  );
  const compoundVariant = expectPresent(
    runtimeDefinition.compoundVariants[0],
    "Expected processor compound variant.",
  );

  assert.equal(Object.hasOwn(compoundVariant.matches, specialAxis), true);
  assert.equal(readOwnStringProperty(compoundVariant.matches, specialAxis), "active");
}

function testRecipeRuntimeDefinitionKeepsReadableClassNames() {
  const definition = createRecipeRuntimeDefinition(
    "button_x1",
    {
      base: { color: "red" },
      compoundVariants: [{ appearance: "primary", css: { fontWeight: 700 } }],
      variants: {
        appearance: {
          primary: { color: "blue" },
          outline: { color: "teal" },
        },
        size: {
          sm: { padding: 4 },
        },
      },
    },
    false,
  );

  assert.equal(definition.baseClassName, "button_x1__base");
  assert.equal(definition.variants.appearance.primary, "button_x1__appearance-primary");
  assert.equal(definition.variants.appearance.outline, "button_x1__appearance-outline");
  assert.equal(definition.variants.size.sm, "button_x1__size-sm");
  assert.equal(
    expectPresent(definition.compoundVariants[0], "Expected compound variant.").className,
    "button_x1__compound-0",
  );
}

function testSlotRecipeRuntimeDefinitionKeepsReadableClassNames() {
  const definition = createSlotRecipeRuntimeDefinition(
    "field_x1",
    {
      slots: ["root", "label"],
      base: { root: { display: "grid" } },
      compoundVariants: [{ size: "md", css: { label: { fontWeight: 700 } } }],
      variants: {
        size: {
          md: {
            root: { gap: 8 },
            label: { color: "blue" },
          },
        },
      },
    },
    false,
  );
  const compoundVariant = expectPresent(
    definition.compoundVariants[0],
    "Expected slot compound variant.",
  );

  assert.equal(definition.baseClassNames.root, "field_x1__root");
  assert.equal(definition.baseClassNames.label, "");
  assert.equal(definition.variants.size.md.root, "field_x1__root-size-md");
  assert.equal(definition.variants.size.md.label, "field_x1__label-size-md");
  assert.equal(compoundVariant.classNames.label, "field_x1__label-compound-0");
  assert.equal(compoundVariant.classNames.root, "");
}

function testRecipeRuntimeDefinitionDisambiguatesReadableLabels() {
  const config = {
    base: { color: "red" },
    compoundVariants: [{ compound: "0", css: { fontWeight: 700 } }],
    variants: {
      compound: { "0": { color: "blue" } },
      a: { "b-c": { color: "teal" } },
      "a-b": { c: { color: "plum" } },
      base: { "%": { color: "gray" } },
    },
  } as const;
  const definition = createRecipeRuntimeDefinition("button_x1", config, false);

  // "compound-0" is claimed by both the compound variant and the variant tuple;
  // the deterministic tuple hash keeps the two class names distinct.
  const compoundClassName = expectPresent(
    definition.compoundVariants[0],
    "Expected compound variant.",
  ).className;
  const axisClassName = definition.variants.compound["0"];
  assert.notEqual(compoundClassName, axisClassName);
  [compoundClassName, axisClassName].forEach((className) => {
    assert.match(className, /^button_x1__compound-0-[0-9a-z]+$/u);
  });

  // Sanitized labels collapse {"a":{"b-c"}} and {"a-b":{"c"}} to "a-b-c"; the
  // hash fallback must keep them apart.
  assert.notEqual(definition.variants.a["b-c"], definition.variants["a-b"].c);
  [definition.variants.a["b-c"], definition.variants["a-b"].c].forEach((className) => {
    assert.match(className, /^button_x1__a-b-c-[0-9a-z]+$/u);
  });

  // "base" is reserved for the base class, and "%" sanitizes to an empty
  // segment, so the variant label collapses to "base" and must be hashed away
  // from `button_x1__base`.
  assert.equal(definition.baseClassName, "button_x1__base");
  assert.notEqual(definition.variants.base["%"], "button_x1__base");
  assert.match(definition.variants.base["%"], /^button_x1__base-[0-9a-z]+$/u);

  // All generated names stay selector-safe and unique.
  const allClassNames = [
    compoundClassName,
    ...Object.values(definition.variants).flatMap((values) => Object.values(values)),
  ];
  allClassNames.forEach((className) => {
    assert.match(className, /^[0-9A-Za-z_-]+$/u);
  });
  assert.equal(new Set(allClassNames).size, allClassNames.length);

  // Identical configs resolve to identical names on every build.
  assert.deepEqual(createRecipeRuntimeDefinition("button_x1", config, false), definition);
}

function testRecipeRuntimeDefinitionMinifiedClassNamesAreStable() {
  // Locked to the dx-styles@1.0.0 minified output: these exact class names
  // shipped to consumers and must stay byte-identical for identical configs.
  const definition = createRecipeRuntimeDefinition(
    "button_x1",
    {
      compoundVariants: [{ appearance: "primary", css: { fontWeight: 700 } }],
      variants: {
        appearance: { primary: { color: "blue" } },
        size: { sm: { padding: 4 } },
      },
    },
    true,
  );

  assert.equal(definition.variants.appearance.primary, "button_x1_7xs7ox");
  assert.equal(definition.variants.size.sm, "button_x1_mq2cwe");
  assert.equal(
    expectPresent(definition.compoundVariants[0], "Expected compound variant.").className,
    "button_x1_64otyw",
  );

  const slotDefinition = createSlotRecipeRuntimeDefinition(
    "field_x1",
    {
      slots: ["root", "label"],
      base: { root: { display: "grid" } },
      compoundVariants: [{ size: "md", css: { label: { fontWeight: 700 } } }],
      variants: {
        size: { md: { root: { gap: 8 } } },
      },
    },
    true,
  );

  assert.equal(slotDefinition.baseClassNames.root, "field_x1_g9pemf");
  assert.equal(slotDefinition.variants.size.md.root, "field_x1_fiwg79");
  assert.equal(
    expectPresent(slotDefinition.compoundVariants[0], "Expected slot compound variant.")
      .classNames.label,
    "field_x1_hv57xe",
  );
}

function testPackageExports() {
  const packageJsonValue: unknown = JSON.parse(
    readFileSync(join(process.cwd(), "package.json"), "utf8"),
  );

  assert.ok(isDxStylesPackageJson(packageJsonValue));

  const packageJson = packageJsonValue;
  const packageRoot = join(process.cwd(), ".");
  const exportPaths = Object.values(packageJson.exports)
    .flatMap((entry) => [entry.bun, entry.default, entry.import, entry.require, entry.types])
    .filter((entry): entry is string => typeof entry === "string");
  const runtimeExport = packageJson.exports["./runtime"];
  const rootExport = packageJson.exports["."];
  const preevalRuntimeExport = packageJson.exports["./preeval-runtime"];

  assert.equal(rootExport.default, "./dist/index.js");
  assert.equal(rootExport.import, "./dist/index.js");
  assert.equal(rootExport["wyw-in-js"], undefined);
  assert.equal(runtimeExport.bun, "./dist/runtime/index.js");
  assert.equal(preevalRuntimeExport.import, "./preeval-runtime.js");
  assert.equal(preevalRuntimeExport.types, "./preeval-runtime.d.ts");
  assert.equal(packageJson.files.includes("dist/**/*.d.ts"), true);
  assert.equal(packageJson.files.includes("dist/**/*.js"), true);
  assert.equal(packageJson.files.includes("dist/**/*.js.map"), true);
  assert.equal(packageJson.files.includes("preeval-runtime.d.ts"), true);
  assert.equal(packageJson.files.includes("preeval-runtime.js"), true);
  assert.equal(packageJson.files.includes("processors/*.js"), true);
  assert.equal(packageJson.files.includes("wyw-eval-entry.js"), false);
  assert.equal(packageJson.files.includes("wyw-eval-entry.d.ts"), false);
  assert.equal(packageJson.files.includes("wyw-entry.js"), false);
  assert.equal(packageJson.files.includes("wyw-entry.d.ts"), false);
  assert.equal(packageJson.files.includes("wyw-runtime.js"), false);
  assert.equal(packageJson.files.includes("wyw-runtime.d.ts"), false);
  assert.equal(existsSync(join(packageRoot, "dist/style-handle-contract2.js")), false);

  [...exportPaths, ...Object.values(packageJson["wyw-in-js"].tags)].forEach((relativePath) => {
    assert.equal(
      existsSync(join(packageRoot, relativePath)),
      true,
      `Expected built artifact to exist: ${relativePath}`,
    );
  });

  const workspaceTsConfigValue: unknown = JSON.parse(
    readFileSync(join(process.cwd(), "tsconfig.base.json"), "utf8"),
  );

  assert.ok(isRecord(workspaceTsConfigValue));

  const workspaceTsConfig = workspaceTsConfigValue as WorkspaceTsConfig;
  assert.deepEqual(
    workspaceTsConfig.compilerOptions?.paths?.["dx-styles/preeval-runtime"],
    ["./preeval-runtime.ts"],
  );
}

async function testPackageExportConditionResolution() {
  const tempRootBase = join(process.cwd(), ".tmp", "dx-styles-build-tests");
  await mkdir(tempRootBase, { recursive: true });
  const packageRoot = await mkdtemp(join(tempRootBase, "package-conditions-"));

  try {
    await mkdir(join(packageRoot, "src"), { recursive: true });
    await writeFile(
      join(packageRoot, "package.json"),
      JSON.stringify(
        {
          name: "dx-styles-package-conditions-fixture",
          private: true,
          type: "module",
        },
        null,
        2,
      ),
    );
    await writeFile(join(packageRoot, "src", "index.ts"), "\n");
    await linkDxStylesFixtureDependency(packageRoot);

    const defaultResolved = resolvePackageExportWithNode(
      packageRoot,
      "dx-styles",
      ["import", "node", "default"],
    );
    const conditionResolved = resolvePackageExportWithNode(
      packageRoot,
      "dx-styles",
      ["wyw-in-js", "import", "node", "default"],
    );

    assert.equal(
      realpathSync(defaultResolved),
      realpathSync(resolve(process.cwd(), "dist/index.js")),
    );
    assert.equal(
      realpathSync(conditionResolved),
      realpathSync(resolve(process.cwd(), "dist/index.js")),
    );
  } finally {
    await rm(packageRoot, { force: true, recursive: true });
  }
}

async function testCssTransform() {
  const result = await runWywTransform(
    `
      import { css } from "dx-styles";

      const base = css({
        display: "flex",
        color: "red",
        "&:hover": {
          color: "green",
        },
        "@media (width >= 48rem)": {
          color: "purple",
        },
      });

      export const button = css(base, {
        color: "blue",
        fillOpacity: 0.5,
        gridRowSpan: 2,
        strokeWidth: 2,
        "&:hover": {
          color: "orange",
        },
        "@media (width >= 48rem)": {
          color: "black",
        },
      });
    `,
    "composition.ts",
  );

  assert.match(result.code, /export const button = "[^"]+"/u);
  assert.match(result.cssText ?? "", /\.button_[^{]+\{[^}]*display:flex;[^}]*color:blue;/u);
  assert.match(result.cssText ?? "", /color:blue;/u);
  assert.match(result.cssText ?? "", /fill-opacity:0.5;/u);
  assert.match(result.cssText ?? "", /grid-row-span:2;/u);
  assert.match(result.cssText ?? "", /stroke-width:2;/u);
  assert.equal((result.cssText ?? "").includes("grid-row-span:2px"), false);
  assert.equal((result.cssText ?? "").includes("stroke-width:2px"), false);
  assert.match(result.cssText ?? "", /:hover\{color:orange;\}/u);
  assert.match(result.cssText ?? "", /@media \(width >= 48rem\)\{[^}]*color:black;/u);
}

async function testCssTransformComposesPublicStyleHandles() {
  const handle = createStyleHandle("public_button_root");

  assert.equal(css(handle), "public_button_root");

  const result = await runWywTransform(
    `
      import { createStyleHandle, css } from "dx-styles";

      const root = createStyleHandle("public_button_root");

      export const wrapper = css(root, {
        color: "red",
      });

      export const nested = css(wrapper, {
        backgroundColor: "blue",
      });

      export const composedOnly = css(root);
    `,
    "public-style-handle.ts",
  );

  const wrapperMatch = /export const wrapper = "public_button_root (wrapper_[^"]+)";/u.exec(
    result.code,
  );
  const nestedMatch = /export const nested = "public_button_root (nested_[^"]+)";/u.exec(
    result.code,
  );

  assert.ok(wrapperMatch, result.code);
  assert.ok(nestedMatch, result.code);
  assert.notEqual(wrapperMatch[1], nestedMatch[1]);
  assert.match(result.code, /export const composedOnly = "public_button_root";/u);
  assert.match(result.cssText ?? "", /\.wrapper_[^{]+\{[^}]*color:red;/u);
  assert.match(result.cssText ?? "", /\.nested_[^{]+\{[^}]*color:red;[^}]*background-color:blue;/u);
  assert.equal((result.cssText ?? "").includes("public_button_root"), false);
  assert.equal((result.cssText ?? "").includes("composedOnly_"), false);
}

async function testCssTransformRejectsNestedStyleHandles() {
  await assert.rejects(
    () =>
      runWywTransform(
        `
          import { createStyleHandle, css } from "dx-styles";

          const root = createStyleHandle("public_button_root");

          export const invalid = css({
            color: root,
          });
        `,
        "public-style-handle-invalid-style-object.ts",
      ),
    /style property "color" cannot reference a style handle/u,
  );

  await assert.rejects(
    () =>
      runWywTransform(
        `
          import { createStyleHandle, css } from "dx-styles";

          const root = createStyleHandle("public_button_root");

          export const invalid = css({
            color: [root],
          });
        `,
        "public-style-handle-invalid-style-array.ts",
      ),
    /style property "color" cannot use non-primitive array values/u,
  );
}

async function testCssTransformRejectsClassValuesInSelectorKeys() {
  // Interpolating a css()/recipe() result into a selector key stringifies the
  // preeval descriptor to "[object Object]"; the build must fail instead of
  // emitting the garbage selector.
  await assert.rejects(
    () =>
      runWywTransform(
        `
          import { css } from "dx-styles";

          const parent = css({ color: "red" });

          export const child = css({
            [\`.\${parent} &\`]: {
              color: "blue",
            },
          });
        `,
        "css-class-value-in-selector-key.ts",
      ),
    /class values cannot be interpolated into selector keys/u,
  );

  await assert.rejects(
    () =>
      runWywTransform(
        `
          import { css, recipe } from "dx-styles";

          const button = recipe({ base: { color: "red" }, variants: {} });

          export const child = css({
            [\`\${button} &\`]: {
              color: "blue",
            },
          });
        `,
        "recipe-class-value-in-selector-key.ts",
      ),
    /class values cannot be interpolated into selector keys/u,
  );
}

async function testCssTransformRejectsEmbeddedDescriptorValues() {
  await assert.rejects(
    () =>
      runWywTransform(
        `
          import { css } from "dx-styles";

          const parent = css({ color: "red" });

          export const child = css({
            "&:hover": parent,
          });
        `,
        "css-descriptor-as-style-value.ts",
      ),
    /style property "&:hover" cannot embed a css\(\)\/recipe\(\)\/createTheme\(\) result/u,
  );

  await assert.rejects(
    () =>
      runWywTransform(
        `
          import { css, recipe } from "dx-styles";

          const button = recipe({ base: { color: "red" }, variants: {} });

          export const child = css(button, {
            color: "blue",
          });
        `,
        "recipe-as-css-part.ts",
      ),
    /style objects and previously declared css\(\) results/u,
  );
}

async function testCssRtlTransform() {
  const result = await runWywTransform(
    `
      import { css } from "dx-styles";

      export const root = css({
        $rtl: true,
        left: 0,
        marginRight: "8px",
        paddingLeft: "4px",
        textAlign: "left",
      });
    `,
    "rtl-css.ts",
  );

  const cssText = result.cssText ?? "";

  assert.match(cssText, /left:0;/u);
  assert.match(cssText, /margin-right:8px;/u);
  assert.match(cssText, /padding-left:4px;/u);
  assert.match(cssText, /text-align:left;/u);
  assert.match(cssText, /:dir\(rtl\) \.root_[^{]+\{[^}]*left:auto;[^}]*right:0;/u);
  assert.match(cssText, /:dir\(rtl\) \.root_[^{]+\{[^}]*margin-left:8px;[^}]*margin-right:0;/u);
  assert.match(cssText, /:dir\(rtl\) \.root_[^{]+\{[^}]*padding-left:0;[^}]*padding-right:4px;/u);
  assert.match(cssText, /:dir\(rtl\) \.root_[^{]+\{[^}]*text-align:right;/u);
  assert.equal(cssText.includes("$rtl"), false);
}

async function testCssRtlTransformPreservesNestedScopes() {
  const result = await runWywTransform(
    `
      import { css } from "dx-styles";

      export const root = css({
        $rtl: true,
        "&:hover": {
          paddingRight: "6px",
        },
        "@media (width >= 48rem)": {
          left: 1,
        },
      });
    `,
    "rtl-nested.ts",
  );

  const cssText = result.cssText ?? "";

  assert.match(
    cssText,
    /:dir\(rtl\) \.root_[^{]+:hover\{[^}]*padding-left:6px;[^}]*padding-right:0;/u,
  );
  assert.match(
    cssText,
    /@media \(width >= 48rem\)\{[\s\S]*:dir\(rtl\) \.root_[^{]+\{[^}]*left:auto;[^}]*right:1px;/u,
  );
}

async function testCssRtlTransformRespectsNoFlip() {
  const result = await runWywTransform(
    `
      import { css } from "dx-styles";

      export const root = css({
        $rtl: true,
        paddingLeft: "4px",
        "&::before": {
          $noflip: true,
          left: 0,
        },
      });
    `,
    "rtl-noflip.ts",
  );

  const cssText = result.cssText ?? "";

  assert.match(cssText, /:dir\(rtl\) \.root_[^{]+\{[^}]*padding-right:4px;/u);
  assert.match(cssText, /\.root_[^{]+::before\{left:0;\}/u);
  assert.equal(/:dir\(rtl\) \.root_[^{]+::before/u.test(cssText), false);
  assert.equal(cssText.includes("$noflip"), false);
}

async function testCssRtlTransformPreservesAuthoredRtlSelector() {
  const result = await runWywTransform(
    `
      import { css } from "dx-styles";

      export const root = css({
        $rtl: true,
        left: 0,
        ":dir(rtl) &": {
          paddingLeft: "2px",
          right: 10,
        },
      });
    `,
    "rtl-authored-selector.ts",
  );

  const cssText = result.cssText ?? "";

  assert.equal(cssText.includes(":dir(rtl) :dir(rtl)"), false);
  assert.match(cssText, /:dir\(rtl\) \.root_[^{]+\{[^}]*left:auto;[^}]*right:10px;/u);
  assert.match(cssText, /:dir\(rtl\) \.root_[^{]+\{[^}]*padding-left:2px;/u);
  assert.equal(cssText.includes("left:10px"), false);
}

async function testCssRtlTransformLeavesPlainStylesUnchanged() {
  const result = await runWywTransform(
    `
      import { css } from "dx-styles";

      export const root = css({
        paddingLeft: "4px",
      });
    `,
    "rtl-plain.ts",
  );

  const cssText = result.cssText ?? "";

  assert.match(cssText, /padding-left:4px;/u);
  assert.equal(cssText.includes(":dir(rtl)"), false);
}

async function testCssRtlTransformRejectsInvalidMarkers() {
  await assert.rejects(
    () =>
      runWywTransform(
        `
          import { css } from "dx-styles";

          export const root = css({
            $rtl: false,
            color: "blue",
          });
        `,
        "rtl-invalid-marker.ts",
      ),
    /dx-styles \$rtl marker only accepts true\./u,
  );

  await assert.rejects(
    () =>
      runWywTransform(
        `
          import { css } from "dx-styles";

          export const root = css({
            color: true,
          });
        `,
        "rtl-invalid-boolean.ts",
      ),
    /dx-styles style property "color" cannot be true/u,
  );
}

async function testCssTransformRejectsUnsupportedScalars() {
  await assert.rejects(
    () =>
      runWywTransform(
        `
          import { css } from "dx-styles";

          export const button = css({
            width: NaN,
          });
        `,
        "css-invalid-non-finite-number.ts",
      ),
    /style property "width" must be a finite number/u,
  );

  await assert.rejects(
    () =>
      runWywTransform(
        `
          import { css } from "dx-styles";

          export const button = css(0);
        `,
        "css-invalid-scalar.ts",
      ),
    /style objects and previously declared css\(\) results/u,
  );

  await assert.rejects(
    () =>
      runWywTransform(
        `
          import { css } from "dx-styles";

          export const button = css(new Date());
        `,
        "css-invalid-instance.ts",
      ),
    /style objects and previously declared css\(\) results|unsupported non-plain object \(Date\)/u,
  );

  await assert.rejects(
    () =>
      runWywTransform(
        `
          import { css } from "dx-styles";

          const malformed = { __dxStyles: { kind: "css" } };

          export const button = css(malformed);
        `,
        "css-invalid-descriptor.ts",
      ),
    /style objects and previously declared css\(\) results/u,
  );
}

// Guards the static-vs-eval equivalence of css() composition shapes. This is
// also the acceptance harness for a future css() processor manifest: wyw's
// current `style-object-call` semantics collapse css() results to a class-name
// string, while the eval path sees a preeval descriptor (with registry side
// effects and the "[object Object]" selector-key diagnostic built on top), so
// the tag must stay on the JS implementation until wyw can express both value
// domains. Every case below must stay byte-identical across strategies.
async function testCssStaticParityMatrix() {
  const tempRootBase = join(process.cwd(), ".tmp", "dx-styles-static-css-tests");
  await mkdir(tempRootBase, { recursive: true });

  const cases: readonly {
    readonly entry: string;
    readonly expectStatic: boolean;
    readonly files?: Readonly<Record<string, string>>;
    readonly name: string;
  }[] = [
    {
      entry: [
        'import { css } from "dx-styles";',
        "",
        'export const a = css({ color: "red" });',
        "",
      ].join("\n"),
      expectStatic: true,
      name: "plain-object",
    },
    {
      entry: [
        'import { css } from "dx-styles";',
        "",
        'export const a = css({ color: "red" }, { padding: "4px" });',
        "",
      ].join("\n"),
      expectStatic: true,
      name: "merge-two-objects",
    },
    {
      entry: [
        'import { css } from "dx-styles";',
        "",
        'const tokens = { accent: "rebeccapurple", pad: "6px" };',
        "",
        "export const a = css({ color: tokens.accent, padding: tokens.pad });",
        "",
      ].join("\n"),
      expectStatic: true,
      name: "same-file-const-refs",
    },
    {
      entry: [
        'import { createStyleHandle, css } from "dx-styles";',
        "",
        'const root = createStyleHandle("public_matrix_root");',
        "",
        'export const a = css(root, { color: "blue" });',
        "",
      ].join("\n"),
      expectStatic: false,
      name: "runtime-handle-compose",
    },
    {
      entry: [
        'import { css } from "dx-styles";',
        "",
        'const base = css({ color: "red" });',
        "",
        'export const b = css(base, { padding: "2px" });',
        "",
      ].join("\n"),
      expectStatic: true,
      name: "same-file-css-compose",
    },
    {
      entry: [
        'import { css } from "dx-styles";',
        'import { base } from "./base";',
        "",
        'export const b = css(base, { padding: "2px" });',
        "",
      ].join("\n"),
      expectStatic: true,
      files: {
        "base.ts": [
          'import { css } from "dx-styles";',
          "",
          'export const base = css({ color: "red" });',
          "",
        ].join("\n"),
      },
      name: "cross-file-css-compose",
    },
    {
      entry: [
        'import { css } from "dx-styles";',
        'import { pad } from "./dyn";',
        "",
        "export const a = css({ padding: pad });",
        "",
      ].join("\n"),
      expectStatic: false,
      files: {
        // String(...) keeps the value deterministic while staying opaque to
        // the static resolver, so the case exercises the eval fallback.
        "dyn.ts": ['export const pad = String("3px");', ""].join("\n"),
      },
      name: "dynamic-arg",
    },
  ];

  for (const item of cases) {
    const fixtureRoot = await mkdtemp(join(tempRootBase, `${item.name}-`));
    try {
      await Promise.all(
        Object.entries(item.files ?? {}).map(([name, source]) =>
          writeFile(join(fixtureRoot, name), source),
        ),
      );

      let evalFileCount = 0;
      const eventEmitter = new EventEmitter(
        (labels, type) => {
          if (type === "start" && labels.method === "transform:evalFile") {
            evalFileCount += 1;
          }
        },
        () => 0,
        () => {},
      );

      const staticResult = await runWywTransform(
        item.entry,
        join(fixtureRoot, "entry.ts"),
        { eventEmitter },
      );
      const executeResult = await runWywTransform(
        item.entry,
        join(fixtureRoot, "entry.ts"),
        { evalStrategy: "execute" },
      );

      assert.equal(
        staticResult.cssText,
        executeResult.cssText,
        `cssText parity failed for "${item.name}"`,
      );
      assert.equal(
        staticResult.code,
        executeResult.code,
        `code parity failed for "${item.name}"`,
      );
      if (item.expectStatic) {
        assert.equal(
          evalFileCount,
          0,
          `expected "${item.name}" to transform without eval`,
        );
      }
    } finally {
      await rm(fixtureRoot, { force: true, recursive: true });
    }
  }
}

async function testCreateVarTransform() {
  const result = await runWywTransform(
    `
      import { createVar, css, setVar } from "dx-styles";

      const bg = createVar();

      export const surface = css(setVar(bg, "red"), { color: bg });
    `,
    "create-var.ts",
  );

  const cssText = result.cssText ?? "";
  const declaration = /(--[a-zA-Z0-9_-]+):red;/u.exec(cssText);
  assert.ok(declaration, `expected a hashed private var declaration, got: ${cssText}`);
  const name = declaration[1];
  // The reference resolves to the very same hashed name as the declaration.
  assert.ok(cssText.includes(`color:var(${name})`), `expected color:var(${name}), got: ${cssText}`);
  // It is a private hashed name, not a readable public token.
  assert.equal(name.startsWith("--dxds-"), false);
}

async function testCreateVarCrossFileStaticTransform() {
  const tempRootBase = join(process.cwd(), ".tmp", "dx-styles-static-var-tests");
  await mkdir(tempRootBase, { recursive: true });
  const fixtureRoot = await mkdtemp(join(tempRootBase, "cross-file-"));

  const entrySource = [
    'import { css } from "dx-styles";',
    'import { accent, surface } from "./vars";',
    "",
    "export const panel = css({",
    "  background: surface,",
    "  color: accent,",
    "});",
    "",
  ].join("\n");

  try {
    await writeFile(
      join(fixtureRoot, "vars.ts"),
      [
        'import { createVar } from "dx-styles";',
        "",
        "export const accent = createVar();",
        "export const surface = createVar();",
        "",
      ].join("\n"),
    );

    let evalFileCount = 0;
    const eventEmitter = new EventEmitter(
      (labels, type) => {
        if (type === "start" && labels.method === "transform:evalFile") {
          evalFileCount += 1;
        }
      },
      () => 0,
      () => {},
    );

    const staticResult = await runWywTransform(entrySource, join(fixtureRoot, "entry.ts"), {
      eventEmitter,
    });

    // Imported private vars resolve statically: nothing is executed at build time.
    assert.equal(evalFileCount, 0);
    const cssText = staticResult.cssText ?? "";
    const references = [...cssText.matchAll(/var\((--[a-zA-Z0-9_-]+)\)/gu)].map(
      (match) => match[1],
    );
    // Both vars land as distinct hashed private names.
    assert.equal(new Set(references).size, 2, cssText);
    references.forEach((name) => {
      assert.equal(name?.startsWith("--dxds-"), false);
    });
    // No live construction survives, and the inlined import stays a watched
    // dependency so edits to the vars module still invalidate consumers.
    assert.equal(/createVar\s*\(/u.test(staticResult.code), false, staticResult.code);
    assert.equal(staticResult.code.includes("./vars"), false, staticResult.code);
    assert.equal(
      (staticResult.dependencies ?? []).some((dependency) => dependency.endsWith("vars.ts")),
      true,
      JSON.stringify(staticResult.dependencies ?? []),
    );

    // Forcing the eval path produces byte-identical output.
    const executeResult = await runWywTransform(entrySource, join(fixtureRoot, "entry.ts"), {
      evalStrategy: "execute",
    });
    assert.equal(staticResult.cssText, executeResult.cssText);
    assert.equal(staticResult.code, executeResult.code);
  } finally {
    await rm(fixtureRoot, { force: true, recursive: true });
  }
}

async function testCreateTokenContractTransform() {
  // Parity baseline: the runtime fallback names leaves purely from (shape, prefix).
  const runtimeContract = createTokenContract(
    {
      color: {
        accent: null,
      },
    },
    { prefix: "tc-transform" },
  );
  assert.equal(runtimeContract.color.accent, "var(--tc-transform-color-accent)");

  const result = await runWywTransform(
    `
      import { createTokenContract, css } from "dx-styles";

      const tokens = createTokenContract({
        color: {
          accent: null,
        },
      }, { prefix: "tc-transform" });

      export const accentVar = tokens.color.accent;

      export const surface = css({ color: tokens.color.accent });
    `,
    "create-token-contract.ts",
  );

  // The contract call is replaced with a plain object literal — not left as a live
  // createTokenContract()/preeval call that every consumer would re-run in eval.
  assert.equal(/createTokenContract\s*\(/u.test(result.code), false, result.code);
  assert.equal(result.code.includes("preevalCreateTokenContract"), false, result.code);
  assert.match(result.code, /var\(--tc-transform-color-accent\)/u);

  // The css() consumer resolved the contract leaf statically into the extracted rule,
  // proving the contract is consumable without dragging its construction into eval.
  assert.match(result.cssText ?? "", /color:var\(--tc-transform-color-accent\)/u);
}

async function testCreateTokenContractCrossFileStaticTransform() {
  const tempRootBase = join(process.cwd(), ".tmp", "dx-styles-static-contract-tests");
  await mkdir(tempRootBase, { recursive: true });
  const fixtureRoot = await mkdtemp(join(tempRootBase, "cross-file-"));

  const entrySource = [
    'import { createTheme, css } from "dx-styles";',
    'import { tokens } from "./tokens";',
    "",
    "export const surface = css({ color: tokens.color.accent });",
    "",
    "export const theme = createTheme(tokens, {",
    "  color: {",
    '    accent: "rebeccapurple",',
    "  },",
    '  spacing: "8px",',
    "});",
    "",
  ].join("\n");

  try {
    await writeFile(
      join(fixtureRoot, "tokens.ts"),
      [
        'import { createTokenContract } from "dx-styles";',
        "",
        "export const tokens = createTokenContract(",
        "  {",
        "    color: {",
        "      accent: null,",
        "    },",
        '    spacing: "gap",',
        "  },",
        '  { prefix: "tc-static" },',
        ");",
        "",
      ].join("\n"),
    );

    let evalFileCount = 0;
    const eventEmitter = new EventEmitter(
      (labels, type) => {
        if (type === "start" && labels.method === "transform:evalFile") {
          evalFileCount += 1;
        }
      },
      () => 0,
      () => {},
    );

    const staticResult = await runWywTransform(entrySource, join(fixtureRoot, "entry.ts"), {
      eventEmitter,
    });

    // The consumer resolves the imported contract statically: no module of the
    // graph is executed at build time.
    assert.equal(evalFileCount, 0);
    // css() reads a contract leaf as a plain var() reference.
    assert.match(staticResult.cssText ?? "", /color:var\(--tc-static-color-accent\)/u);
    // createTheme() receives the imported contract value and assigns both the
    // path-derived and the explicitly named leaves.
    assert.match(staticResult.cssText ?? "", /--tc-static-color-accent:rebeccapurple/u);
    assert.match(staticResult.cssText ?? "", /--tc-static-gap:8px/u);
    // No live construction or preeval shim survives in the emitted code.
    assert.equal(/createTokenContract\s*\(/u.test(staticResult.code), false, staticResult.code);
    assert.equal(staticResult.code.includes("preevalCreateTokenContract"), false, staticResult.code);
    // The static import is inlined away, but the contract module stays a watched
    // dependency so edits still invalidate consumers.
    assert.equal(staticResult.code.includes("./tokens"), false, staticResult.code);
    assert.equal(
      (staticResult.dependencies ?? []).some((dependency) => dependency.endsWith("tokens.ts")),
      true,
      JSON.stringify(staticResult.dependencies ?? []),
    );

    // Forcing the eval path produces byte-identical output: the static shortcut
    // changes cost, not semantics.
    const executeResult = await runWywTransform(entrySource, join(fixtureRoot, "entry.ts"), {
      evalStrategy: "execute",
    });
    assert.equal(staticResult.cssText, executeResult.cssText);
    assert.equal(staticResult.code, executeResult.code);
  } finally {
    await rm(fixtureRoot, { force: true, recursive: true });
  }
}

async function testRecipeTransform() {
  const result = await runWywTransform(
    `
      import { recipe } from "dx-styles";

      export const button = recipe({
        base: {
          color: "red",
        },
        variants: {
          intent: {
            primary: {
              color: "blue",
            },
          },
        },
        compoundVariants: [
          {
            intent: "primary",
            css: {
              fontWeight: 700,
            },
          },
        ],
        defaultVariants: {
          intent: "primary",
        },
      });
    `,
    "recipe.ts",
  );

  assert.match(result.code, /dx-styles\/runtime/u);
  assert.match(result.code, /createRuntimeRecipe/u);

  const cssText = result.cssText ?? "";
  const baseIndex = cssText.indexOf("color:red;");
  const variantIndex = cssText.indexOf("color:blue;");
  const compoundIndex = cssText.indexOf("font-weight:700;");

  assert.ok(baseIndex >= 0);
  assert.ok(variantIndex > baseIndex);
  assert.ok(compoundIndex > variantIndex);
}

async function testRecipeTransformMinifiesClassNames() {
  const source = `
    import { recipe } from "dx-styles";

    export const button = recipe({
      base: {
        color: "red",
      },
      variants: {
        intent: {
          primary: {
            color: "blue",
          },
        },
      },
      compoundVariants: [
        {
          intent: "primary",
          css: {
            fontWeight: 700,
          },
        },
      ],
      defaultVariants: {
        intent: "primary",
      },
    });
  `;
  const fixtureName = "recipe-minified.ts";

  const dev = await runWywTransform(source, fixtureName);
  const prod = await runWywTransform(source, fixtureName, {
    displayName: false,
    minifyClassNames: true,
  });

  const devCss = dev.cssText ?? "";
  const prodCss = prod.cssText ?? "";

  // Dev keeps readable scoped suffixes; prod collapses them into short hashes.
  const devSelectors = extractCssSelectors(devCss);
  assert.ok(devSelectors.some((selector) => selector.endsWith("__base")));
  assert.ok(devSelectors.some((selector) => selector.endsWith("__intent-primary")));
  assert.ok(devSelectors.some((selector) => selector.endsWith("__compound-0")));
  assert.equal(prodCss.includes("intent-primary"), false);
  assert.equal(prodCss.includes("compound-0"), false);
  assert.ok(prodCss.length < devCss.length);

  const prodSelectors = extractCssSelectors(prodCss);
  assert.ok(prodSelectors.length >= 3);
  assert.equal(new Set(prodSelectors).size, prodSelectors.length);
  prodSelectors.forEach((selector) => {
    assert.ok(
      selector.length <= 32,
      `expected a short minified class name, got "${selector}" (${selector.length})`,
    );
    // The same name is baked into the runtime JS (CSS <-> runtime consistency).
    assert.ok(prod.code.includes(selector), `class "${selector}" missing from runtime code`);
  });

  // Deterministic across runs (stable caching).
  const prodAgain = await runWywTransform(source, fixtureName, {
    displayName: false,
    minifyClassNames: true,
  });
  assert.equal(prodAgain.cssText ?? "", prodCss);
  assert.equal(prodAgain.code, prod.code);
}

async function testRecipeTransformMinifyDisambiguatesSegments() {
  // Regression: a delimiter join would collapse ["variant","a","b c"] and
  // ["variant","a b","c"] to the same string and thus the same hashed class name.
  // stableStringify keeps the segment tuples distinct, so the two variants must
  // produce two different class names.
  const result = await runWywTransform(
    `
      import { recipe } from "dx-styles";

      export const button = recipe({
        variants: {
          "a": {
            "b c": {
              color: "red",
            },
          },
          "a b": {
            c: {
              color: "blue",
            },
          },
        },
      });
    `,
    "recipe-minify-collision.ts",
    {
      displayName: false,
      minifyClassNames: true,
    },
  );

  const selectors = extractCssSelectors(result.cssText ?? "");
  assert.equal(selectors.length, 2);
  assert.equal(
    new Set(selectors).size,
    2,
    "minified variant class names must not collide across segment boundaries",
  );
}

async function testRecipeTransformDisambiguatesReadableSegments() {
  // Same regression as the minified variant above, for readable dev names:
  // ["a","b c"] and ["a b","c"] both sanitize to the "a-b-c" label, so the
  // deterministic hash fallback must keep the two class names apart.
  const result = await runWywTransform(
    `
      import { recipe } from "dx-styles";

      export const button = recipe({
        variants: {
          "a": {
            "b c": {
              color: "red",
            },
          },
          "a b": {
            c: {
              color: "blue",
            },
          },
        },
      });
    `,
    "recipe-readable-collision.ts",
  );

  const selectors = extractCssSelectors(result.cssText ?? "");
  assert.equal(selectors.length, 2);
  assert.equal(
    new Set(selectors).size,
    2,
    "readable variant class names must not collide across segment boundaries",
  );
  selectors.forEach((selector) => {
    assert.match(selector, /__a-b-c-[0-9a-z]+$/u);
  });
}

async function testRecipeRtlTransform() {
  const result = await runWywTransform(
    `
      import { recipe } from "dx-styles";

      export const button = recipe({
        base: {
          $rtl: true,
          paddingLeft: "4px",
        },
        variants: {
          align: {
            end: {
              $rtl: true,
              textAlign: "right",
            },
          },
        },
        compoundVariants: [
          {
            align: "end",
            css: {
              $rtl: true,
              right: 0,
            },
          },
        ],
      });
    `,
    "rtl-recipe.ts",
  );

  const cssText = result.cssText ?? "";

  assert.equal(cssText.match(/:dir\(rtl\)/gu)?.length, 3);
  assert.match(cssText, /:dir\(rtl\) \.[^{]+\{[^}]*padding-right:4px;/u);
  assert.match(cssText, /:dir\(rtl\) \.[^{]+\{[^}]*text-align:left;/u);
  assert.match(cssText, /:dir\(rtl\) \.[^{]+\{[^}]*left:0;[^}]*right:auto;/u);
}

async function testRecipeTransformUsesSafeVariantSelectors() {
  const result = await runWywTransform(
    `
      import { recipe } from "dx-styles";

      export const button = recipe({
        variants: {
          "a_b": {
            c: {
              color: "blue",
            },
          },
          a: {
            "b_c": {
              color: "green",
            },
          },
          "mode value": {
            "sm/md": {
              color: "purple",
            },
          },
        },
      });
    `,
    "recipe-selectors.ts",
  );

  const selectors = Array.from(
    (result.cssText ?? "").matchAll(/\.([^{\s]+)\{color:(blue|green|purple);/gu),
    (match) => match[1],
  );

  assert.equal(selectors.length, 3);
  assert.equal(new Set(selectors).size, 3);
  assert.equal((result.cssText ?? "").includes("mode value"), false);
  assert.equal((result.cssText ?? "").includes("sm/md"), false);
}

async function testRecipeTransformRejectsMalformedCompoundVariants() {
  await assert.rejects(
    () =>
      runWywTransform(
        `
          import { recipe } from "dx-styles";

          export const button = recipe({
            base: 0,
            variants: {},
          });
        `,
        "recipe-invalid-base-scalar.ts",
      ),
    /style objects and previously declared css\(\) results/u,
  );

  await assert.rejects(
    () =>
      runWywTransform(
        `
          import { recipe } from "dx-styles";

          export const button = recipe({
            variants: {
              size: {
                sm: {
                  color: "blue",
                },
              },
            },
            compoundVariants: [
              {
                size: 123,
                css: {
                  color: "blue",
                },
              },
            ],
          });
        `,
        "recipe-invalid-compound-match.ts",
      ),
    /compound variant #0 (?:must include css and string match values|requires string match values)/u,
  );

  await assert.rejects(
    () =>
      runWywTransform(
        `
          import { recipe } from "dx-styles";

          export const button = recipe({
            compoundVariants: [
              {
                size: "md",
              },
            ],
          });
        `,
        "recipe-invalid-compound-css.ts",
      ),
    /compound variant #0 (?:must include css and string match values|requires a css field)/u,
  );

  await assert.rejects(
    () =>
      runWywTransform(
        `
          import { recipe } from "dx-styles";

          export const button = recipe({
            variants: {
              size: {
                sm: {
                  color: "blue",
                },
              },
            },
            compoundVariants: [
              {
                siz: "sm",
                css: {
                  color: "blue",
                },
              },
            ],
          });
        `,
        "recipe-invalid-compound-axis.ts",
      ),
    /unknown variant axis "siz"/u,
  );
}

async function testSlotRecipeTransform() {
  const result = await runWywTransform(
    `
      import { slotRecipe } from "dx-styles";

      export const popover = slotRecipe({
        slots: ["root", "body"],
        base: {
          root: {
            display: "grid",
          },
          body: {
            padding: 12,
          },
        },
        variants: {
          size: {
            md: {
              body: {
                gap: 8,
              },
            },
          },
        },
        defaultVariants: {
          size: "md",
        },
      });
    `,
    "slot-recipe.ts",
  );

  assert.match(result.code, /createRuntimeSlotRecipe/u);
  assert.match(result.cssText ?? "", /display:grid;/u);
  assert.match(result.cssText ?? "", /padding:12px;/u);
  assert.match(result.cssText ?? "", /gap:8px;/u);
}

async function testSlotRecipeTransformMinifiesClassNames() {
  const source = `
    import { slotRecipe } from "dx-styles";

    export const popover = slotRecipe({
      slots: ["root", "body"],
      base: {
        root: {
          display: "grid",
        },
        body: {
          padding: 12,
        },
      },
      variants: {
        size: {
          md: {
            body: {
              gap: 8,
            },
          },
        },
      },
      compoundVariants: [
        {
          size: "md",
          css: {
            root: {
              outlineWidth: 1,
            },
          },
        },
      ],
      defaultVariants: {
        size: "md",
      },
    });
  `;
  const fixtureName = "slot-recipe-minified.ts";

  const dev = await runWywTransform(source, fixtureName);
  const prod = await runWywTransform(source, fixtureName, {
    displayName: false,
    minifyClassNames: true,
  });

  const devCss = dev.cssText ?? "";
  const prodCss = prod.cssText ?? "";

  // The slot-variant path is the longest readable suffix in dev; prod must
  // collapse it into one short hash.
  const devSelectors = extractCssSelectors(devCss);
  assert.ok(devSelectors.some((selector) => selector.endsWith("__root")));
  assert.ok(devSelectors.some((selector) => selector.endsWith("__body")));
  assert.ok(devSelectors.some((selector) => selector.endsWith("__body-size-md")));
  assert.ok(devSelectors.some((selector) => selector.endsWith("__root-compound-0")));
  assert.equal(prodCss.includes("size-md"), false);
  assert.equal(prodCss.includes("compound-0"), false);
  assert.ok(prodCss.length < devCss.length);

  const prodSelectors = extractCssSelectors(prodCss);
  assert.ok(prodSelectors.length >= 4);
  assert.equal(new Set(prodSelectors).size, prodSelectors.length);
  prodSelectors.forEach((selector) => {
    assert.ok(
      selector.length <= 32,
      `expected a short minified class name, got "${selector}" (${selector.length})`,
    );
    assert.ok(prod.code.includes(selector), `class "${selector}" missing from runtime code`);
  });

  const prodAgain = await runWywTransform(source, fixtureName, {
    displayName: false,
    minifyClassNames: true,
  });
  assert.equal(prodAgain.cssText ?? "", prodCss);
  assert.equal(prodAgain.code, prod.code);
}

async function testSlotRecipeRtlTransform() {
  const result = await runWywTransform(
    `
      import { slotRecipe } from "dx-styles";

      export const popover = slotRecipe({
        slots: ["root", "arrow"],
        base: {
          root: {
            $rtl: true,
            marginLeft: "4px",
          },
        },
        variants: {
          placement: {
            end: {
              arrow: {
                $rtl: true,
                right: 0,
              },
            },
          },
        },
        compoundVariants: [
          {
            placement: "end",
            css: {
              root: {
                $rtl: true,
                textAlign: "left",
              },
            },
          },
        ],
      });
    `,
    "rtl-slot-recipe.ts",
  );

  const cssText = result.cssText ?? "";

  assert.equal(cssText.match(/:dir\(rtl\)/gu)?.length, 3);
  assert.match(cssText, /:dir\(rtl\) \.[^{]+\{[^}]*margin-right:4px;/u);
  assert.match(cssText, /:dir\(rtl\) \.[^{]+\{[^}]*left:0;[^}]*right:auto;/u);
  assert.match(cssText, /:dir\(rtl\) \.[^{]+\{[^}]*text-align:right;/u);
}

async function testSlotRecipeTransformUsesSafeSlotSelectors() {
  const result = await runWywTransform(
    `
      import { slotRecipe } from "dx-styles";

      export const popover = slotRecipe({
        slots: ["root", "body content"],
        base: {
          "body content": {
            padding: 4,
          },
        },
        variants: {
          "a_b": {
            c: {
              "body content": {
                color: "blue",
              },
            },
          },
          a: {
            "b_c": {
              "body content": {
                color: "green",
              },
            },
          },
          "mode:value": {
            "sm/md": {
              "body content": {
                color: "purple",
              },
            },
          },
        },
      });
    `,
    "slot-recipe-selectors.ts",
  );

  const selectors = Array.from(
    (result.cssText ?? "").matchAll(/\.([^{\s]+)\{(?:padding:4px;|color:(?:blue|green|purple);)/gu),
    (match) => match[1],
  );

  assert.ok(selectors.length >= 4);
  assert.equal(new Set(selectors).size, selectors.length);
  assert.equal((result.cssText ?? "").includes("body content"), false);
  assert.equal((result.cssText ?? "").includes("sm/md"), false);
  assert.equal((result.cssText ?? "").includes("mode:value"), false);
}

async function testSlotRecipeTransformRejectsMalformedCompoundVariants() {
  await assert.rejects(
    () =>
      runWywTransform(
        `
          import { slotRecipe } from "dx-styles";

          export const popover = slotRecipe({
            slots: ["root"],
            compoundVariants: [
              {
                size: 123,
                css: {
                  root: {
                    color: "blue",
                  },
                },
              },
            ],
          });
        `,
        "slot-recipe-invalid-compound.ts",
      ),
    /compound variant #0 (?:must include css and string match values|requires string match values)/u,
  );

  await assert.rejects(
    () =>
      runWywTransform(
        `
          import { slotRecipe } from "dx-styles";

          export const popover = slotRecipe({
            slots: ["root"],
            variants: {
              size: {
                sm: {
                  root: {
                    color: "blue",
                  },
                },
              },
            },
            compoundVariants: [
              {
                size: "sm",
                css: 123,
              },
            ],
          });
        `,
        "slot-recipe-invalid-compound-css.ts",
      ),
    /compound variant #0 css must be a slot style object/u,
  );

  await assert.rejects(
    () =>
      runWywTransform(
        `
          import { slotRecipe } from "dx-styles";

          export const popover = slotRecipe({
            slots: ["root"],
            base: {
              root: 0,
            },
          });
        `,
        "slot-recipe-invalid-base-slot.ts",
      ),
    /style objects and previously declared css\(\) results/u,
  );

  await assert.rejects(
    () =>
      runWywTransform(
        `
          import { slotRecipe } from "dx-styles";

          export const popover = slotRecipe({
            slots: ["root"],
            base: {
              root: new Date(),
            },
          });
        `,
        "slot-recipe-invalid-base-instance.ts",
      ),
    /style objects and previously declared css\(\) results|unsupported non-plain object \(Date\)/u,
  );

  await assert.rejects(
    () =>
      runWywTransform(
        `
          import { slotRecipe } from "dx-styles";

          export const popover = slotRecipe({
            slots: ["root"],
            base: {
              body: {
                color: "blue",
              },
            },
          });
        `,
        "slot-recipe-unknown-base-slot.ts",
      ),
    /slotRecipe\(\) base references unknown slot "body"/u,
  );

  await assert.rejects(
    () =>
      runWywTransform(
        `
          import { slotRecipe } from "dx-styles";

          export const popover = slotRecipe({
            slots: ["root"],
            variants: {
              size: {
                md: {
                  body: {
                    color: "blue",
                  },
                },
              },
            },
          });
        `,
        "slot-recipe-unknown-variant-slot.ts",
      ),
    /slotRecipe\(\) variant "size\.md" references unknown slot "body"/u,
  );

  await assert.rejects(
    () =>
      runWywTransform(
        `
          import { slotRecipe } from "dx-styles";

          export const popover = slotRecipe({
            slots: ["root"],
            variants: {
              size: {
                md: {
                  root: {
                    color: "blue",
                  },
                },
              },
            },
            compoundVariants: [
              {
                size: "md",
                css: {
                  body: {
                    color: "blue",
                  },
                },
              },
            ],
          });
        `,
        "slot-recipe-unknown-compound-slot.ts",
      ),
    /slotRecipe\(\) compound variant #0 css references unknown slot "body"/u,
  );
}

async function testThemeTransform() {
  const runtimeContract = createTokenContract(
    {
      color: {
        accent: null,
      },
    },
    { prefix: "theme-transform" },
  );
  const runtimeAssignments = assignVars(runtimeContract, {
    color: {
      accent: "#f00",
    },
  });

  const result = await runWywTransform(
    `
      import { createTheme, createTokenContract } from "dx-styles";

      const contract = createTokenContract({
        color: {
          accent: null,
        },
      }, { prefix: "theme-transform" });

      export const themeClassName = createTheme(contract, {
        color: {
          accent: "#f00",
        },
      });
    `,
    "theme.ts",
  );

  assert.match(result.code, /export const themeClassName = "[^"]+"/u);
  assert.match(result.cssText ?? "", /#f00/u);

  const emittedVariableName = /(--[^:]+):#f00/u.exec(result.cssText ?? "")?.[1];
  const runtimeVariableNames = Object.keys(runtimeAssignments);

  assert.equal(runtimeVariableNames.length, 1);
  assert.equal(emittedVariableName, runtimeVariableNames[0]);
}

async function testThemeTransformRejectsPartialContract() {
  await assert.rejects(
    () =>
      runWywTransform(
        `
          import { createTheme, createTokenContract } from "dx-styles";

          const contract = createTokenContract({
            color: {
              accent: null,
              muted: null,
            },
          }, { prefix: "theme-invalid" });

          export const themeClassName = createTheme(contract, {
            color: {
              accent: "#f00",
            },
          });
        `,
        "theme-invalid.js",
      ),
    /Missing value for "muted"\./u,
  );
}

async function testThemeTransformRejectsInvalidRootValues() {
  await assert.rejects(
    () =>
      runWywTransform(
        `
          import { createTheme, createTokenContract } from "dx-styles";

          const contract = createTokenContract({
            color: {
              accent: null,
            },
          }, { prefix: "theme-invalid-root" });

          export const themeClassName = createTheme(contract, "oops");
        `,
        "theme-invalid-root.js",
      ),
    /theme values must be an object\./u,
  );
}

async function testExplainMetadataTransform() {
  const result = await runWywTransform(
    `
      import { css, createTheme, createTokenContract, recipe, slotRecipe } from "dx-styles";

      const shared = css({
        color: "red",
      });

      export const button = css(shared, {
        backgroundColor: "blue",
      });

      export const buttonRecipe = recipe({
        base: shared,
        variants: {
          size: {
            sm: shared,
          },
        },
        compoundVariants: [
          {
            size: "sm",
            css: shared,
          },
        ],
      });

      export const popoverRecipe = slotRecipe({
        slots: ["root", "body"],
        base: {
          root: shared,
        },
        variants: {
          size: {
            sm: {
              body: shared,
            },
          },
        },
        compoundVariants: [
          {
            size: "sm",
            css: {
              root: shared,
            },
          },
        ],
      });

      const contract = createTokenContract(
        {
          color: {
            accent: null,
          },
        },
        { prefix: "explain-metadata" },
      );

      export const themeClassName = createTheme(contract, {
        color: {
          accent: "#f00",
        },
      });
    `,
    "explain-metadata.ts",
    { outputMetadata: true },
  );

  const { metadata } = result;
  if (metadata == null) {
    assert.equal(
      supportsWywOutputMetadata(),
      false,
      "linked WyW transform should emit metadata when outputMetadata is enabled",
    );
    return;
  }

  const processorsByName = new Map(
    metadata.processors.map((processor) => [processor.displayName, processor] as const),
  );

  const sharedProcessor = expectPresent(
    processorsByName.get("shared"),
    "shared processor metadata is missing",
  );
  const buttonProcessor = expectPresent(
    processorsByName.get("button"),
    "button processor metadata is missing",
  );
  const buttonRecipeProcessor = expectPresent(
    processorsByName.get("buttonRecipe"),
    "buttonRecipe processor metadata is missing",
  );
  const popoverRecipeProcessor = expectPresent(
    processorsByName.get("popoverRecipe"),
    "popoverRecipe processor metadata is missing",
  );
  const themeProcessor = expectPresent(
    processorsByName.get("themeClassName"),
    "themeClassName processor metadata is missing",
  );

  const sharedExplain = findDxStylesExplainPayload(sharedProcessor.artifacts);
  const buttonExplain = findDxStylesExplainPayload(buttonProcessor.artifacts);
  const buttonRecipeExplain = findDxStylesExplainPayload(buttonRecipeProcessor.artifacts);
  const popoverRecipeExplain = findDxStylesExplainPayload(popoverRecipeProcessor.artifacts);
  const themeExplain = findDxStylesExplainPayload(themeProcessor.artifacts);
  if (
    sharedExplain === null ||
    buttonExplain === null ||
    buttonRecipeExplain === null ||
    popoverRecipeExplain === null ||
    themeExplain === null
  ) {
    throw new Error("dx-styles explain metadata is missing");
  }

  assert.equal(sharedExplain.entries.length, 1);
  assert.equal(sharedExplain.entries[0].kind, "css");
  assert.equal(sharedExplain.entries[0].composeRefs.length, 0);
  assert.equal(typeof sharedExplain.entries[0].preevalClassName, "string");

  assert.deepEqual(buttonExplain.entries[0].composeRefs, [
    sharedExplain.entries[0].preevalClassName,
  ]);
  assert.equal(buttonExplain.entries[0].kind, "css");
  assert.equal(buttonExplain.entries[0].node, "style");

  assert.deepEqual(
    buttonRecipeExplain.entries.map((entry) => entry.node),
    ["base", "variant", "compound"],
  );
  const recipeVariantEntry = buttonRecipeExplain.entries[1];
  const recipeCompoundEntry = buttonRecipeExplain.entries[2];
  assert.equal(recipeVariantEntry.node, "variant");
  assert.equal(recipeCompoundEntry.node, "compound");
  assert.deepEqual(buttonRecipeExplain.entries[0].composeRefs, [
    sharedExplain.entries[0].preevalClassName,
  ]);
  assert.deepEqual(recipeVariantEntry.variant, { axis: "size", value: "sm" });
  assert.deepEqual(recipeVariantEntry.composeRefs, [sharedExplain.entries[0].preevalClassName]);
  assert.deepEqual(recipeCompoundEntry.matches, { size: "sm" });

  assert.deepEqual(
    popoverRecipeExplain.entries.map((entry) =>
      "slot" in entry ? { node: entry.node, slot: entry.slot } : { node: entry.node, slot: null },
    ),
    [
      { node: "base", slot: "root" },
      { node: "variant", slot: "body" },
      { node: "compound", slot: "root" },
    ],
  );
  const slotVariantEntry = popoverRecipeExplain.entries[1];
  const slotCompoundEntry = popoverRecipeExplain.entries[2];
  assert.equal(slotVariantEntry.node, "variant");
  assert.equal(slotCompoundEntry.node, "compound");
  assert.deepEqual(popoverRecipeExplain.entries[0].composeRefs, [
    sharedExplain.entries[0].preevalClassName,
  ]);
  assert.deepEqual(slotVariantEntry.variant, { axis: "size", value: "sm" });
  assert.deepEqual(slotCompoundEntry.matches, { size: "sm" });

  assert.equal(themeExplain.entries.length, 1);
  assert.equal(themeExplain.entries[0].kind, "theme");
  assert.deepEqual(themeExplain.entries[0].variables, ["--explain-metadata-color-accent"]);
  assert.equal(typeof themeExplain.entries[0].preevalClassName, "string");

  const manifest = createDxStylesExplainManifest(metadata, {
    cssFile: "src/explain-metadata.wyw-in-js.css",
    source: "src/explain-metadata.ts",
  });
  const explainIndex = createDxStylesExplainIndex(manifest);
  const buttonRecords = explainIndex.get(buttonExplain.entries[0].className);
  assert.ok(buttonRecords);
  assert.equal(buttonRecords.length, 1);
  assert.equal(buttonRecords[0].compose[0].className, sharedExplain.entries[0].className);
  assert.equal(buttonRecords[0].compose[0].symbol, "shared");
}

function testExplainManifestFormatting() {
  const manifest: DxStylesExplainManifest = {
    cssFile: "src/button.wyw-in-js.css",
    dependencies: [],
    processors: [
      {
        artifacts: [
          [
            "dx-styles:explain",
            {
              entries: [
                {
                  className: "dxs_shared_out",
                  composeRefs: [],
                  kind: "css",
                  node: "style",
                  preevalClassName: "dxs_shared_ref",
                },
              ],
              version: 1,
            },
          ],
        ],
        className: "shared",
        displayName: "shared",
        start: { column: 2, line: 3 },
      },
      {
        artifacts: [
          [
            "dx-styles:explain",
            {
              entries: [
                {
                  className: "dxs_button_out",
                  composeRefs: ["dxs_shared_ref"],
                  kind: "css",
                  node: "style",
                  preevalClassName: "dxs_button_ref",
                },
              ],
              version: 1,
            },
          ],
        ],
        className: "button",
        displayName: "button",
        start: { column: 0, line: 8 },
      },
      {
        artifacts: [
          [
            "dx-styles:explain",
            {
              entries: [
                {
                  className: "dxr_button_size_sm",
                  composeRefs: ["dxs_shared_ref"],
                  kind: "recipe",
                  node: "variant",
                  variant: {
                    axis: "size",
                    value: "sm",
                  },
                },
              ],
              version: 1,
            },
          ],
        ],
        className: "buttonRecipe",
        displayName: "buttonRecipe",
        start: { column: 0, line: 12 },
      },
    ],
    replacements: [],
    rules: {
      ".dxr_button_size_sm": {
        className: "dxr_button_size_sm",
        cssText: "@media (width >= 768px){color:red;}",
        displayName: "buttonRecipe",
        start: { column: 0, line: 12 },
      },
      ".dxs_button_out": {
        className: "dxs_button_out",
        cssText: "&:hover{background:blue;}",
        displayName: "button",
        start: { column: 0, line: 8 },
      },
      ".dxs_shared_out": {
        className: "dxs_shared_out",
        cssText: "color:red;",
        displayName: "shared",
        start: { column: 2, line: 3 },
      },
    },
    source: "src/button.ts",
    version: 1,
  };

  const explainIndex = createDxStylesExplainIndex(manifest);
  const buttonRecords = explainIndex.get("dxs_button_out");
  const recipeRecords = explainIndex.get("dxr_button_size_sm");
  assert.ok(buttonRecords);
  assert.ok(recipeRecords);
  assert.equal(buttonRecords.length, 1);
  assert.equal(recipeRecords.length, 1);
  assert.deepEqual(buttonRecords[0].compose[0], {
    className: "dxs_shared_out",
    node: "style",
    reference: "dxs_shared_ref",
    source: "src/button.ts",
    symbol: "shared",
    unresolved: false,
  });
  assert.equal(recipeRecords[0].selector, ".dxr_button_size_sm");
  assert.equal(recipeRecords[0].cssText, "@media (width >= 768px){color:red;}");
  assert.equal(recipeRecords[0].node, "variant");
  assert.deepEqual(recipeRecords[0].variant, { axis: "size", value: "sm" });

  const report = formatDxStylesExplainReport(manifest, [
    "dxs_button_out",
    "dxr_button_size_sm missing",
  ]);
  assert.match(report, /dxs_button_out/u);
  assert.match(report, /compose: dxs_shared_out <= shared style \(src\/button\.ts\)/u);
  assert.match(report, /dxr_button_size_sm/u);
  assert.match(report, /variant: size=sm/u);
  assert.match(report, /css: @media \(width >= 768px\)\{color:red;\}/u);
  assert.match(report, /missing\n {2}status: not found/u);
}

function testExplainManifestHandlesAmbiguousComposeRefs() {
  const manifest: DxStylesExplainManifest = {
    cssFile: "src/button.wyw-in-js.css",
    dependencies: [],
    processors: [
      {
        artifacts: [
          [
            "dx-styles:explain",
            {
              entries: [
                {
                  className: "dxs_shared_primary",
                  composeRefs: [],
                  kind: "css",
                  node: "style",
                  preevalClassName: "dxs_shared_ref",
                },
              ],
              version: 1,
            },
          ],
        ],
        className: "sharedPrimary",
        displayName: "sharedPrimary",
        start: undefined,
      },
      {
        artifacts: [
          [
            "dx-styles:explain",
            {
              entries: [
                {
                  className: "dxs_shared_secondary",
                  composeRefs: [],
                  kind: "css",
                  node: "style",
                  preevalClassName: "dxs_shared_ref",
                },
              ],
              version: 1,
            },
          ],
        ],
        className: "sharedSecondary",
        displayName: "sharedSecondary",
        start: { column: 4, line: 7 },
      },
      {
        artifacts: [
          [
            "dx-styles:explain",
            {
              entries: [
                {
                  className: "dxs_button_out",
                  composeRefs: ["dxs_shared_ref"],
                  kind: "css",
                  node: "style",
                  preevalClassName: "dxs_button_ref",
                },
              ],
              version: 1,
            },
          ],
        ],
        className: "button",
        displayName: "button",
        start: { column: 0, line: 12 },
      },
    ],
    replacements: [],
    rules: {
      ".dxs_button_out": {
        className: "dxs_button_out",
        cssText: "background:blue;",
        displayName: "button",
        start: { column: 0, line: 12 },
      },
      ".dxs_shared_primary": {
        className: "dxs_shared_primary",
        cssText: "color:red;",
        displayName: "sharedPrimary",
        start: undefined,
      },
      ".dxs_shared_secondary": {
        className: "dxs_shared_secondary",
        cssText: "color:blue;",
        displayName: "sharedSecondary",
        start: { column: 4, line: 7 },
      },
    },
    source: "src/button.ts",
    version: 1,
  };

  const explainIndex = createDxStylesExplainIndex(manifest);
  const buttonRecords = explainIndex.get("dxs_button_out");
  assert.ok(buttonRecords);
  assert.equal(buttonRecords.length, 1);
  assert.deepEqual(buttonRecords[0].compose[0], {
    reason: "ambiguous",
    reference: "dxs_shared_ref",
    unresolved: true,
  });
  assert.equal(buttonRecords[0].start?.line, 12);

  const report = formatDxStylesExplainReport(manifest, ["dxs_button_out"]);
  assert.match(report, /compose: dxs_shared_ref \(ambiguous\)/u);
}

async function testDiagnosticsTransform() {
  const result = await runWywTransform(
    `
      import { css, recipe, slotRecipe } from "dx-styles";

      export const root = css({
        paddingLeft: "4px",
        float: "left",
        "&:hover": {
          textAlign: "right",
        },
      });

      export const button = recipe({
        base: {
          marginRight: "2px",
          float: "right",
        },
        variants: {
          align: {
            start: {
              textAlign: "left",
            },
          },
        },
      });

      export const popover = slotRecipe({
        slots: ["arrow"],
        base: {
          arrow: {
            right: 0,
          },
        },
      });
    `,
    "diagnostics.ts",
    { outputMetadata: true },
  );

  const diagnostics = readWywTestDiagnostics(result.diagnostics as unknown);

  assert.equal(diagnostics.length, 7);
  assert.deepEqual(
    diagnostics.map((diagnostic) => diagnostic.category),
    [
      "dx-styles/physical-direction-property",
      "dx-styles/physical-direction-value",
      "dx-styles/physical-direction-value",
      "dx-styles/physical-direction-property",
      "dx-styles/physical-direction-value",
      "dx-styles/physical-direction-value",
      "dx-styles/physical-direction-property",
    ],
  );
  assert.ok(
    diagnostics.every(
      (diagnostic) =>
        diagnostic.severity === "warning" &&
        diagnostic.filename.endsWith("diagnostics.ts") &&
        diagnostic.start !== null,
    ),
  );
  assert.match(diagnostics[0].message, /paddingInlineStart/u);
  assert.match(diagnostics[1].message, /float: "inline-start"/u);
  assert.match(diagnostics[2].message, /textAlign: "end"/u);
  assert.match(diagnostics[3].message, /marginInlineEnd/u);
  assert.match(diagnostics[4].message, /float: "inline-end"/u);
  assert.match(diagnostics[5].message, /textAlign: "start"/u);
  assert.match(diagnostics[6].message, /insetInlineEnd/u);

  const metadataArtifactNames =
    result.metadata?.processors.flatMap((processor) =>
      processor.artifacts.map(([artifactName]) => artifactName),
    ) ?? [];
  assert.equal(metadataArtifactNames.includes("wyw-in-js:diagnostic"), false);
}

async function testDiagnosticsDoNotRequireMetadataOutput() {
  const result = await runWywTransform(
    `
      import { css } from "dx-styles";

      export const root = css({
        paddingLeft: "4px",
      });
    `,
    "diagnostics-disabled.ts",
  );

  const diagnostics = readWywTestDiagnostics(result.diagnostics as unknown);

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].category, "dx-styles/physical-direction-property");
  assert.match(diagnostics[0].message, /paddingInlineStart/u);
}

async function testDiagnosticsRespectRtlMarkers() {
  const result = await runWywTransform(
    `
      import { css } from "dx-styles";

      export const root = css({
        $rtl: true,
        borderLeft: "1px solid red",
        left: 0,
        paddingLeft: "4px",
        textAlign: "left",
        "&::before": {
          $noflip: true,
          right: 0,
        },
      });
    `,
    "diagnostics-rtl.ts",
  );

  const diagnostics = readWywTestDiagnostics(result.diagnostics as unknown);

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].category, "dx-styles/physical-direction-property");
  assert.match(diagnostics[0].message, /borderInlineStart/u);
}

async function testSharedLibraryBuildExtractsDirectDxStylesImports() {
  const tempRootBase = join(process.cwd(), ".tmp", "dx-styles-build-tests");
  await mkdir(tempRootBase, { recursive: true });
  const packageRoot = await mkdtemp(join(tempRootBase, "build-direct-import-"));

  try {
    const srcRoot = join(packageRoot, "src");
    await mkdir(srcRoot, { recursive: true });
    await writeFile(
      join(packageRoot, "package.json"),
      JSON.stringify(
        {
          name: "dx-styles-build-direct-import-fixture",
          private: true,
          type: "module",
        },
        null,
        2,
      ),
    );
    await writeFile(
      join(srcRoot, "index.ts"),
      [
        'import { css } from "dx-styles";',
        "",
        'export const className = css({ color: "red" });',
        "",
      ].join("\n"),
    );
    await linkDxStylesFixtureDependency(packageRoot);

    runSharedLibraryBuild(packageRoot);

    const builtCode = await readFile(join(packageRoot, "dist/index.js"), "utf8");
    const builtCss = await readFile(join(packageRoot, "dist/index.css"), "utf8");
    const builtModule = await importBuiltModule(packageRoot, "index.js", isBuiltClassNameModule);

    assert.match(builtCode, /import\s*["']\.\/index\.css["'];/u);
    assert.equal(builtCode.includes("dx-styles"), false);
    assert.equal(typeof builtModule.className, "string");
    assert.ok(builtModule.className.length > 0);
    assert.equal(builtCode.includes('css({ color: "red" })'), false);
    assert.match(builtCss, /color:red;?/u);
  } finally {
    await rm(packageRoot, { force: true, recursive: true });
  }
}

async function testSharedLibraryBuildAllowsOrdinaryLocalClassExports() {
  const tempRootBase = join(process.cwd(), ".tmp", "dx-styles-build-tests");
  await mkdir(tempRootBase, { recursive: true });
  const packageRoot = await mkdtemp(join(tempRootBase, "build-ordinary-export-"));

  try {
    const srcRoot = join(packageRoot, "src");
    await mkdir(srcRoot, { recursive: true });
    await writeFile(
      join(packageRoot, "package.json"),
      JSON.stringify(
        {
          name: "dx-styles-build-ordinary-export-fixture",
          private: true,
          type: "module",
        },
        null,
        2,
      ),
    );
    await writeFile(
      join(srcRoot, "styles.ts"),
      [
        'import { css } from "dx-styles";',
        "",
        'export const base = css({ color: "red" });',
        "",
      ].join("\n"),
    );
    await writeFile(
      join(srcRoot, "index.ts"),
      ['import { base } from "./styles";', "", "export const className = base;", ""].join("\n"),
    );
    await linkDxStylesFixtureDependency(packageRoot);

    runSharedLibraryBuild(packageRoot);

    const builtCode = await readFile(join(packageRoot, "dist/index.js"), "utf8");
    const builtStylesCode = await readFile(join(packageRoot, "dist/styles.js"), "utf8");
    const builtStylesCss = await readFile(join(packageRoot, "dist/styles.css"), "utf8");
    const builtIndexModule = await importBuiltModule(
      packageRoot,
      "index.js",
      isBuiltClassNameModule,
    );
    const builtStylesModule = await importBuiltModule(packageRoot, "styles.js", isBuiltBaseModule);

    assert.match(builtCode, /from\s*['"]\.\/styles\.js['"]/u);
    assert.match(builtStylesCode, /import\s*["']\.\/styles\.css["'];/u);
    assert.equal(builtStylesCode.includes("dx-styles"), false);
    assert.equal(builtIndexModule.className, builtStylesModule.base);
    assert.equal(typeof builtStylesModule.base, "string");
    assert.ok(builtStylesModule.base.length > 0);
    assert.match(builtStylesCss, /color:red;?/u);
  } finally {
    await rm(packageRoot, { force: true, recursive: true });
  }
}

async function testSharedLibraryBuildSkipsNonTaggedDxStylesImports() {
  const tempRootBase = join(process.cwd(), ".tmp", "dx-styles-build-tests");
  await mkdir(tempRootBase, { recursive: true });
  const packageRoot = await mkdtemp(join(tempRootBase, "build-runtime-utility-"));

  try {
    const srcRoot = join(packageRoot, "src");
    await mkdir(srcRoot, { recursive: true });
    await writeFile(
      join(packageRoot, "package.json"),
      JSON.stringify(
        {
          name: "dx-styles-build-runtime-utility-fixture",
          private: true,
          type: "module",
        },
        null,
        2,
      ),
    );
    await writeFile(
      join(srcRoot, "utils.ts"),
      [
        'import { cx } from "dx-styles";',
        "",
        'export const className = cx("foo", "bar");',
        "",
      ].join("\n"),
    );
    await linkDxStylesFixtureDependency(packageRoot);

    runSharedLibraryBuild(packageRoot);

    const builtCode = await readFile(join(packageRoot, "dist/utils.js"), "utf8");
    const builtModule = await importBuiltModule(packageRoot, "utils.js", isBuiltClassNameModule);

    assert.match(builtCode, /dx-styles/u);
    assert.equal(builtCode.includes("./utils.css"), false);
    assert.equal(builtModule.className, cx("foo", "bar"));
    assert.equal(existsSync(join(packageRoot, "dist/utils.css")), false);
  } finally {
    await rm(packageRoot, { force: true, recursive: true });
  }
}

async function testSharedLibraryBuildSkipsAliasedRuntimeUtilityImports() {
  const tempRootBase = join(process.cwd(), ".tmp", "dx-styles-build-tests");
  await mkdir(tempRootBase, { recursive: true });
  const packageRoot = await mkdtemp(join(tempRootBase, "build-runtime-alias-"));

  try {
    const srcRoot = join(packageRoot, "src");
    await mkdir(srcRoot, { recursive: true });
    await writeFile(
      join(packageRoot, "package.json"),
      JSON.stringify(
        {
          name: "dx-styles-build-runtime-alias-fixture",
          private: true,
          type: "module",
        },
        null,
        2,
      ),
    );
    await writeFile(
      join(srcRoot, "utils.ts"),
      [
        'import { cx as css } from "dx-styles";',
        "",
        'export const className = css("foo", "bar");',
        "",
      ].join("\n"),
    );
    await linkDxStylesFixtureDependency(packageRoot);

    runSharedLibraryBuild(packageRoot);

    const builtCode = await readFile(join(packageRoot, "dist/utils.js"), "utf8");
    const builtModule = await importBuiltModule(packageRoot, "utils.js", isBuiltClassNameModule);

    assert.match(builtCode, /dx-styles/u);
    assert.equal(builtCode.includes("./utils.css"), false);
    assert.equal(builtModule.className, cx("foo", "bar"));
    assert.equal(existsSync(join(packageRoot, "dist/utils.css")), false);
  } finally {
    await rm(packageRoot, { force: true, recursive: true });
  }
}

async function testSharedLibraryBuildSkipsNonDxStylesTags() {
  const tempRootBase = join(process.cwd(), ".tmp", "dx-styles-build-tests");
  await mkdir(tempRootBase, { recursive: true });
  const packageRoot = await mkdtemp(join(tempRootBase, "build-non-dx-styles-"));

  try {
    const srcRoot = join(packageRoot, "src");
    await mkdir(srcRoot, { recursive: true });
    await writeFile(
      join(packageRoot, "package.json"),
      JSON.stringify(
        {
          name: "dx-styles-build-non-dx-styles-fixture",
          private: true,
          type: "module",
        },
        null,
        2,
      ),
    );
    await writeFile(
      join(srcRoot, "foreign-tag.ts"),
      [
        "export function defineForeignStyles<TValue>(value: TValue): TValue {",
        "  return value;",
        "}",
        "",
      ].join("\n"),
    );
    await writeFile(
      join(srcRoot, "index.ts"),
      [
        'import { defineForeignStyles } from "./foreign-tag";',
        "",
        'export const styles = defineForeignStyles({ root: { color: "red" } });',
        "",
      ].join("\n"),
    );

    runSharedLibraryBuild(packageRoot);

    const builtCode = await readFile(join(packageRoot, "dist/index.js"), "utf8");
    const builtHelperCode = await readFile(join(packageRoot, "dist/foreign-tag.js"), "utf8");
    assert.match(builtCode, /\.\/foreign-tag\.js/u);
    assert.match(builtCode, /defineForeignStyles/u);
    assert.match(builtHelperCode, /defineForeignStyles/u);
    assert.equal(builtCode.includes("./index.css"), false);
    assert.equal(existsSync(join(packageRoot, "dist/index.css")), false);
  } finally {
    await rm(packageRoot, { force: true, recursive: true });
  }
}

async function testSharedLibraryBuildRemovesCssArtifactsWhenDxStylesImportIsRemoved() {
  const tempRootBase = join(process.cwd(), ".tmp", "dx-styles-build-tests");
  await mkdir(tempRootBase, { recursive: true });
  const packageRoot = await mkdtemp(join(tempRootBase, "build-artifact-cleanup-"));

  try {
    const srcRoot = join(packageRoot, "src");
    const entryPath = join(srcRoot, "index.ts");

    await mkdir(srcRoot, { recursive: true });
    await writeFile(
      join(packageRoot, "package.json"),
      JSON.stringify(
        {
          name: "dx-styles-build-artifact-cleanup-fixture",
          private: true,
          type: "module",
        },
        null,
        2,
      ),
    );
    await writeFile(
      entryPath,
      [
        'import { css } from "dx-styles";',
        "",
        'export const className = css({ color: "red" });',
        "",
      ].join("\n"),
    );
    await linkDxStylesFixtureDependency(packageRoot);

    runSharedLibraryBuild(packageRoot);

    assert.equal(existsSync(join(packageRoot, "dist/index.css")), true);

    await writeFile(entryPath, ['export const className = "plain";', ""].join("\n"));

    runSharedLibraryBuild(packageRoot);

    const rebuiltCode = await readFile(join(packageRoot, "dist/index.js"), "utf8");
    const rebuiltModule = await importBuiltModule(packageRoot, "index.js", isBuiltClassNameModule);

    assert.equal(existsSync(join(packageRoot, "dist/index.css")), false);
    assert.equal(rebuiltCode.includes("./index.css"), false);
    assert.equal(rebuiltModule.className, "plain");
  } finally {
    await rm(packageRoot, { force: true, recursive: true });
  }
}

async function testSharedLibraryBuildRemovesArtifactsWhenDxStylesSourceIsDeleted() {
  const tempRootBase = join(process.cwd(), ".tmp", "dx-styles-build-tests");
  await mkdir(tempRootBase, { recursive: true });
  const packageRoot = await mkdtemp(join(tempRootBase, "build-source-delete-"));

  try {
    const srcRoot = join(packageRoot, "src");
    const entryPath = join(srcRoot, "index.ts");
    const stylesPath = join(srcRoot, "styles.ts");

    await mkdir(srcRoot, { recursive: true });
    await writeFile(
      join(packageRoot, "package.json"),
      JSON.stringify(
        {
          name: "dx-styles-build-source-delete-fixture",
          private: true,
          type: "module",
        },
        null,
        2,
      ),
    );
    await writeFile(
      stylesPath,
      [
        'import { css } from "dx-styles";',
        "",
        'export const className = css({ color: "red" });',
        "",
      ].join("\n"),
    );
    await writeFile(entryPath, ['export { className } from "./styles";', ""].join("\n"));
    await linkDxStylesFixtureDependency(packageRoot);

    runSharedLibraryBuild(packageRoot);

    assert.equal(existsSync(join(packageRoot, "dist/styles.css")), true);
    assert.equal(existsSync(join(packageRoot, "dist/styles.js")), true);

    await rm(stylesPath, { force: true });
    await writeFile(entryPath, ['export const className = "plain";', ""].join("\n"));

    runSharedLibraryBuild(packageRoot);

    const rebuiltCode = await readFile(join(packageRoot, "dist/index.js"), "utf8");
    const rebuiltModule = await importBuiltModule(packageRoot, "index.js", isBuiltClassNameModule);

    assert.equal(existsSync(join(packageRoot, "dist/styles.css")), false);
    assert.equal(existsSync(join(packageRoot, "dist/styles.js")), false);
    assert.equal(rebuiltCode.includes("./styles.js"), false);
    assert.equal(rebuiltModule.className, "plain");
  } finally {
    await rm(packageRoot, { force: true, recursive: true });
  }
}

async function main() {
  testRuntimeHelpers();
  testRuntimeStyleHandles();
  testRecipePropSplitting();
  await testBuiltRootEntryStyleHandles();
  await testBuiltPreevalRuntimeModule();
  testPreevalRuntimeHelpers();
  testRuntimeSerializerPreservesSpecialDataProperties();
  testStyleObjectsPreserveSpecialDataProperties();
  testProcessorRuntimeDefinitionsPreserveSpecialMatches();
  testRecipeRuntimeDefinitionKeepsReadableClassNames();
  testSlotRecipeRuntimeDefinitionKeepsReadableClassNames();
  testRecipeRuntimeDefinitionDisambiguatesReadableLabels();
  testRecipeRuntimeDefinitionMinifiedClassNamesAreStable();
  testPackageExports();
  await testPackageExportConditionResolution();
  await testCssTransform();
  await testCssTransformComposesPublicStyleHandles();
  await testCssTransformRejectsNestedStyleHandles();
  await testCssTransformRejectsClassValuesInSelectorKeys();
  await testCssTransformRejectsEmbeddedDescriptorValues();
  await testCssRtlTransform();
  await testCssRtlTransformPreservesNestedScopes();
  await testCssRtlTransformRespectsNoFlip();
  await testCssRtlTransformPreservesAuthoredRtlSelector();
  await testCssRtlTransformLeavesPlainStylesUnchanged();
  await testCssRtlTransformRejectsInvalidMarkers();
  await testCssTransformRejectsUnsupportedScalars();
  await testCssStaticParityMatrix();
  await testCreateVarTransform();
  await testCreateVarCrossFileStaticTransform();
  await testCreateTokenContractTransform();
  await testCreateTokenContractCrossFileStaticTransform();
  await testRecipeTransform();
  await testRecipeTransformMinifiesClassNames();
  await testRecipeTransformMinifyDisambiguatesSegments();
  await testRecipeTransformDisambiguatesReadableSegments();
  await testRecipeRtlTransform();
  await testRecipeTransformUsesSafeVariantSelectors();
  await testRecipeTransformRejectsMalformedCompoundVariants();
  await testSlotRecipeTransform();
  await testSlotRecipeTransformMinifiesClassNames();
  await testSlotRecipeRtlTransform();
  await testSlotRecipeTransformUsesSafeSlotSelectors();
  await testSlotRecipeTransformRejectsMalformedCompoundVariants();
  await testThemeTransform();
  await testThemeTransformRejectsPartialContract();
  await testThemeTransformRejectsInvalidRootValues();
  await testExplainMetadataTransform();
  testExplainManifestFormatting();
  testExplainManifestHandlesAmbiguousComposeRefs();
  await testDiagnosticsTransform();
  await testDiagnosticsDoNotRequireMetadataOutput();
  await testDiagnosticsRespectRtlMarkers();
  await testSharedLibraryBuildExtractsDirectDxStylesImports();
  await testSharedLibraryBuildAllowsOrdinaryLocalClassExports();
  await testSharedLibraryBuildSkipsNonTaggedDxStylesImports();
  await testSharedLibraryBuildSkipsAliasedRuntimeUtilityImports();
  await testSharedLibraryBuildSkipsNonDxStylesTags();
  await testSharedLibraryBuildRemovesCssArtifactsWhenDxStylesImportIsRemoved();
  await testSharedLibraryBuildRemovesArtifactsWhenDxStylesSourceIsDeleted();
}

await main();
