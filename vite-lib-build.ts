import { readFile, readdir, rm } from "node:fs/promises";
import { dirname, extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import wyw from "@wyw-in-js/vite";
import browserslist from "browserslist";
import { browserslistToTargets } from "lightningcss";
import { defineConfig } from "vite";
import type { UserConfig } from "vite";

type WywViteOptions = NonNullable<Parameters<typeof wyw>[0]> & Record<string, unknown> & {
  readonly outputMetadata?: boolean;
};

const styleExtensions = new Set([".css", ".scss", ".sass", ".less"]);

const assetExtensions = new Set([
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
]);
const copiedAssetExtensions = new Set([".json"]);
const buildArtifactSuffixes = [".js", ".js.map", ".css", ".css.map", ".wyw-in-js.json"] as const;
const copiedArtifactSuffixes = [".json"] as const;
const removableArtifactSuffixes = [...buildArtifactSuffixes, ...copiedArtifactSuffixes] as const;
const declarationSourceSuffixes = [".d.cts", ".d.mts", ".d.ts"] as const;
const declarationArtifactSuffixes = [
  ".d.cts",
  ".d.cts.map",
  ".d.mts",
  ".d.mts.map",
  ".d.ts",
  ".d.ts.map",
] as const;
const sourceArtifactSuffixes = [
  ...buildArtifactSuffixes,
  ...copiedArtifactSuffixes,
  ...declarationArtifactSuffixes,
] as const;
const sourceExtensions = new Set([".cjs", ".cts", ".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx"]);
const watchExtensions = new Set([
  ...sourceExtensions,
  ".json",
  ...styleExtensions,
  ...assetExtensions,
]);

const toPosixPath = (filePath: string) => filePath.split("\\").join("/");
const workspaceRoot = dirname(fileURLToPath(import.meta.url));

const testFileSuffixes = [
  ".spec.cjs",
  ".spec.cts",
  ".spec.js",
  ".spec.jsx",
  ".spec.mjs",
  ".spec.mts",
  ".spec.ts",
  ".spec.tsx",
  ".test.cjs",
  ".test.cts",
  ".test.js",
  ".test.jsx",
  ".test.mjs",
  ".test.mts",
  ".test.ts",
  ".test.tsx",
] as const;

const isTestFile = (filePath: string) =>
  filePath.includes("__tests__") || testFileSuffixes.some((suffix) => filePath.endsWith(suffix));

export interface PackageBuildPaths {
  readonly packageRoot: string;
  readonly srcRoot: string;
  readonly outRoot: string;
}

export interface PackageBuildOptions {
  readonly ignoredFiles?: ReadonlySet<string>;
  readonly ignoredWatchFiles?: ReadonlySet<string>;
  readonly obsoleteArtifactSuffixes?: readonly string[];
}

interface PackageJsonWithBuildOptions {
  readonly sharedLibBuild?: unknown;
}

interface SharedLibBuildOptions extends Record<string, unknown> {
  readonly ignoredSourceFiles?: unknown;
  readonly ignoredWatchFiles?: unknown;
  readonly obsoleteArtifactSuffixes?: unknown;
}

interface CollectFilesOptions extends PackageBuildOptions {
  readonly ignoredDirectories?: readonly string[];
}

interface WorkspaceTsConfig {
  readonly compilerOptions?: {
    readonly paths?: Record<string, unknown>;
  };
}

interface WorkspaceSourceAlias {
  readonly find: RegExp;
  readonly replacement: string;
}

type WorkspacePathMappingEntry = [specifier: string, targets: string[]];

const regexEscapePattern = /[.*+?^${}()|[\]\\]/g;
const wildcardPattern = /\\\*/g;

function escapeRegex(source: string): string {
  return source.replace(regexEscapePattern, "\\$&");
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isWorkspacePathMappingEntry(
  entry: [string, unknown],
): entry is WorkspacePathMappingEntry {
  return (
    Array.isArray(entry[1]) &&
    entry[1].length > 0 &&
    entry[1].every((target) => typeof target === "string")
  );
}

function readStringArrayOption(
  options: Record<string, unknown>,
  key: string,
  itemLabel = "strings",
): readonly string[] | undefined {
  const value = options[key];
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(`sharedLibBuild.${key} must contain non-empty ${itemLabel}.`);
  }

  const entries: string[] = [];
  value.forEach((entry) => {
    if (typeof entry !== "string" || entry.length === 0) {
      throw new Error(`sharedLibBuild.${key} must contain non-empty ${itemLabel}.`);
    }
    entries.push(entry);
  });

  return entries;
}

function readSharedLibBuildOptions(
  packageRoot: string,
  value: PackageJsonWithBuildOptions,
): PackageBuildOptions {
  if (value.sharedLibBuild === undefined) {
    return {};
  }

  if (!isJsonObject(value.sharedLibBuild)) {
    throw new Error("sharedLibBuild must be an object.");
  }

  const sharedLibBuildOptions = value.sharedLibBuild as SharedLibBuildOptions;
  const ignoredSourceFiles = readStringArrayOption(sharedLibBuildOptions, "ignoredSourceFiles");
  const ignoredWatchFiles = readStringArrayOption(sharedLibBuildOptions, "ignoredWatchFiles");
  const obsoleteArtifactSuffixes = readStringArrayOption(
    sharedLibBuildOptions,
    "obsoleteArtifactSuffixes",
    "artifact suffixes",
  );
  const options: PackageBuildOptions = {};

  if (ignoredSourceFiles !== undefined) {
    Object.assign(options, {
      ignoredFiles: new Set(
        ignoredSourceFiles.map((ignoredSourceFile) => resolve(packageRoot, ignoredSourceFile)),
      ),
    });
  }

  if (ignoredWatchFiles !== undefined) {
    Object.assign(options, {
      ignoredWatchFiles: new Set(
        ignoredWatchFiles.map((ignoredWatchFile) => resolve(packageRoot, ignoredWatchFile)),
      ),
    });
  }

  if (obsoleteArtifactSuffixes !== undefined) {
    Object.assign(options, {
      obsoleteArtifactSuffixes,
    });
  }

  return options;
}

function createWorkspaceSourceAlias(
  baseDir: string,
  specifier: string,
  target: string,
): WorkspaceSourceAlias | null {
  const specifierWildcardCount = specifier.match(/\*/g)?.length ?? 0;
  const targetWildcardCount = target.match(/\*/g)?.length ?? 0;

  if (specifierWildcardCount !== targetWildcardCount) {
    return null;
  }

  let captureGroupIndex = 0;
  const find = new RegExp(
    `^${escapeRegex(specifier).replace(wildcardPattern, () => {
      captureGroupIndex += 1;
      return "(.+)";
    })}$`,
  );
  const replacement = resolve(baseDir, target).replace(/\*/g, () => {
    captureGroupIndex += 1;
    return `$${captureGroupIndex - specifierWildcardCount}`;
  });

  return {
    find,
    replacement,
  };
}

export function resolvePackageBuildPaths(
  packageRootInput = process.env.SHARED_LIB_BUILD_PACKAGE_ROOT ?? process.cwd(),
): PackageBuildPaths {
  const packageRoot = resolve(packageRootInput);

  return {
    packageRoot,
    srcRoot: resolve(packageRoot, "src"),
    outRoot: resolve(packageRoot, "dist"),
  };
}

export async function loadPackageBuildOptions(packageRoot: string): Promise<PackageBuildOptions> {
  const packageJsonPath = resolve(packageRoot, "package.json");
  const packageJsonValue: unknown = JSON.parse(await readFile(packageJsonPath, "utf8"));

  if (!isJsonObject(packageJsonValue)) {
    throw new Error("package.json must contain an object.");
  }

  return readSharedLibBuildOptions(packageRoot, packageJsonValue);
}

export async function collectSources(
  dir: string,
  options: PackageBuildOptions = {},
): Promise<string[]> {
  return collectFilesByExtension(dir, sourceExtensions, options);
}

export async function collectCopiedAssets(dir: string): Promise<string[]> {
  return collectFilesByExtension(dir, copiedAssetExtensions);
}

export async function collectWatchInputs(
  dir: string,
  options: CollectFilesOptions = {},
): Promise<string[]> {
  return collectFilesByExtension(dir, watchExtensions, options);
}

export function createWorkspaceSourceAliases(
  baseDir: string,
  pathMappings: Readonly<Record<string, unknown>>,
): WorkspaceSourceAlias[] {
  return Object.entries(pathMappings)
    .filter(isWorkspacePathMappingEntry)
    .sort(([leftSpecifier], [rightSpecifier]) => rightSpecifier.length - leftSpecifier.length)
    .flatMap(([specifier, targets]) => {
      const [target] = targets;
      if (typeof target !== "string") {
        return [];
      }

      const alias = createWorkspaceSourceAlias(baseDir, specifier, target);
      return alias === null ? [] : [alias];
    });
}

async function loadWorkspaceSourceAliases(baseDir: string): Promise<WorkspaceSourceAlias[]> {
  const tsconfigPath = resolve(baseDir, "tsconfig.base.json");
  const tsconfigValue: unknown = JSON.parse(await readFile(tsconfigPath, "utf8"));
  const compilerOptions =
    typeof tsconfigValue === "object" && tsconfigValue !== null
      ? (tsconfigValue as WorkspaceTsConfig).compilerOptions
      : undefined;

  if (!compilerOptions?.paths) {
    return [];
  }

  return createWorkspaceSourceAliases(baseDir, compilerOptions.paths);
}

function isWithinDirectory(filePath: string, directoryPath: string): boolean {
  const rel = relative(directoryPath, filePath);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

async function collectFilesByExtension(
  dir: string,
  extensions: ReadonlySet<string>,
  options: CollectFilesOptions = {},
): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = resolve(dir, entry.name);

      if (entry.isDirectory()) {
        if (
          options.ignoredDirectories?.some((ignoredDirectory) =>
            isWithinDirectory(fullPath, ignoredDirectory),
          )
        ) {
          return [];
        }

        return collectFilesByExtension(fullPath, extensions, options);
      }

      const ext = extname(entry.name);
      const isDeclarationFile = declarationSourceSuffixes.some((suffix) =>
        entry.name.endsWith(suffix),
      );
      const isSourceFile =
        extensions.has(ext) && !isDeclarationFile && options.ignoredFiles?.has(fullPath) !== true;
      if (isSourceFile && !isTestFile(fullPath)) {
        return [fullPath];
      }

      return [];
    }),
  );

  return nestedFiles.flat();
}

async function collectFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        return [];
      }

      throw error;
    },
  );
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = resolve(dir, entry.name);

      if (entry.isDirectory()) {
        return collectFiles(fullPath);
      }

      return [fullPath];
    }),
  );

  return nestedFiles.flat();
}

export async function cleanBuildArtifacts(
  dir: string,
  options: {
    readonly obsoleteArtifactSuffixes?: readonly string[];
    readonly preserveDeclarations: boolean;
  },
): Promise<void> {
  if (!options.preserveDeclarations) {
    await rm(dir, { force: true, recursive: true });
    return;
  }

  const entries = await readdir(dir, { withFileTypes: true }).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        return [];
      }

      throw error;
    },
  );

  await Promise.all(
    entries.map(async (entry) => {
      const fullPath = resolve(dir, entry.name);

      if (entry.isDirectory()) {
        await cleanBuildArtifacts(fullPath, options);
        return;
      }

      const shouldRemoveArtifact =
        removableArtifactSuffixes.some((suffix) => entry.name.endsWith(suffix)) ||
        options.obsoleteArtifactSuffixes?.some((suffix) => entry.name.endsWith(suffix)) === true;

      if (shouldRemoveArtifact) {
        await rm(fullPath, { force: true });
      }
    }),
  );
}

function getSourceArtifactBase(sourcePath: string, srcRoot: string) {
  return toPosixPath(relative(srcRoot, sourcePath)).replace(/\.[^.]+$/u, "");
}

function getCopiedAssetOutputPath(sourcePath: string, srcRoot: string) {
  return toPosixPath(relative(srcRoot, sourcePath));
}

function createJsonModuleDeclarationSource(sourceText: string): string {
  const jsonValue: unknown = JSON.parse(sourceText);

  return `declare const value: ${JSON.stringify(jsonValue, null, 2)};\nexport default value;\n`;
}

function getOutputArtifactBase(artifactPath: string, outRoot: string, suffixes: readonly string[]) {
  const relativePath = toPosixPath(relative(outRoot, artifactPath));
  const suffix = suffixes.find((candidate) => relativePath.endsWith(candidate));

  if (suffix === undefined) {
    return null;
  }

  return relativePath.slice(0, -suffix.length);
}

export async function removeSourceArtifacts(
  sourcePath: string,
  srcRoot: string,
  outRoot: string,
  options: {
    readonly includeDeclarations?: boolean;
    readonly obsoleteArtifactSuffixes?: readonly string[];
  } = {},
): Promise<void> {
  const artifactBase = getSourceArtifactBase(sourcePath, srcRoot);
  const artifactSuffixes = options.includeDeclarations
    ? [...sourceArtifactSuffixes, ...(options.obsoleteArtifactSuffixes ?? [])]
    : [...removableArtifactSuffixes, ...(options.obsoleteArtifactSuffixes ?? [])];

  await Promise.all(
    artifactSuffixes.map((suffix) =>
      rm(resolve(outRoot, `${artifactBase}${suffix}`), { force: true }),
    ),
  );
}

export async function pruneOrphanedArtifacts(
  srcRoot: string,
  outRoot: string,
  sourcePaths: ReadonlySet<string>,
  options: {
    readonly includeDeclarations?: boolean;
    readonly obsoleteArtifactSuffixes?: readonly string[];
    readonly preservedArtifacts?: ReadonlySet<string>;
  } = {},
): Promise<void> {
  const validArtifactBases = new Set(
    [...sourcePaths].map((sourcePath) => getSourceArtifactBase(sourcePath, srcRoot)),
  );
  const artifactSuffixes = options.includeDeclarations
    ? sourceArtifactSuffixes
    : buildArtifactSuffixes;
  const existingFiles = await collectFiles(outRoot);

  await Promise.all(
    existingFiles.map(async (artifactPath) => {
      const isObsoleteArtifact =
        options.obsoleteArtifactSuffixes?.some((suffix) => artifactPath.endsWith(suffix)) === true;
      if (isObsoleteArtifact) {
        await rm(artifactPath, { force: true });
        return;
      }

      const artifactBase = getOutputArtifactBase(artifactPath, outRoot, artifactSuffixes);

      if (
        artifactBase === null ||
        validArtifactBases.has(artifactBase) ||
        options.preservedArtifacts?.has(artifactPath) === true
      ) {
        return;
      }

      await rm(artifactPath, { force: true });
    }),
  );
}

const isAssetImport = (id: string) => assetExtensions.has(extname(id));

const isStyleImport = (id: string) => styleExtensions.has(extname(id));

const isBareImport = (id: string) => !id.startsWith(".") && !isAbsolute(id);

const getAssetFileName = (assetInfo: {
  readonly names?: readonly string[];
  readonly originalFileNames?: readonly string[];
}) =>
  (assetInfo.names?.[0] ?? assetInfo.originalFileNames?.[0] ?? "[name][extname]").replace(
    /\.wyw-in-js\.css$/u,
    ".css",
  );

const isOutsidePackage = (id: string, importer: string | undefined, packageRoot: string) => {
  if (!importer || !id.startsWith(".")) {
    return false;
  }

  const resolved = resolve(dirname(importer), id);
  const rel = relative(packageRoot, resolved);
  return rel.startsWith("..");
};

export default defineConfig(async (): Promise<UserConfig> => {
  const watchMode = process.env.SHARED_LIB_BUILD_WATCH === "true";
  const { packageRoot, srcRoot, outRoot } = resolvePackageBuildPaths();
  const packageBuildOptions = await loadPackageBuildOptions(packageRoot);
  const sources = await collectSources(srcRoot, packageBuildOptions);
  const copiedAssets = await collectCopiedAssets(srcRoot);
  const workspaceSourceAliases = await loadWorkspaceSourceAliases(workspaceRoot);
  const minifyClassNames = process.env.SHARED_LIB_BUILD_MINIFY === "true";
  // Resolve the workspace browserslist matrix to lightningcss targets, so it adds
  // only the vendor prefixes those browsers actually need (replacing stylis'
  // verbose built-in prefixer, disabled below).
  const cssTargets = browserslistToTargets(browserslist());
  const wywOptions: WywViteOptions = {
    babelOptions: {
      presets: ["@babel/preset-typescript"],
    },
    // Keep readable `displayName_slug` names in dev; drop the prefix in prod so the
    // base class name collapses to the bare slug.
    displayName: !minifyClassNames,
    // Minify dx-styles recipe/slotRecipe scoped class names. Namespaced under
    // `dxStyles`; read back from `this.options.processors.dxStyles` in the processors.
    processors: { dxStyles: { minifyClassNames } },
    outputMetadata: true,
    // Disable stylis' built-in prefixer (very verbose: expands `display:flex` into
    // -webkit-box/-ms-flexbox/etc.). lightningcss adds only the prefixes the
    // browserslist matrix actually needs (see `css.lightningcss.targets` below).
    prefixer: false,
    preserveCssPaths: true,
  };

  if (sources.length === 0) {
    throw new Error(`No source files found under ${srcRoot}`);
  }

  if (!watchMode) {
    await cleanBuildArtifacts(outRoot, {
      obsoleteArtifactSuffixes: packageBuildOptions.obsoleteArtifactSuffixes,
      preserveDeclarations: true,
    });
  }

  const externalizeModule = (id: string, importer: string | undefined) => {
    if (id.startsWith("\0")) {
      return false;
    }

    if (isStyleImport(id)) {
      return false;
    }

    if (isAssetImport(id)) {
      return true;
    }

    if (isOutsidePackage(id, importer, packageRoot)) {
      return true;
    }

    return isBareImport(id);
  };

  const config: UserConfig = {
    root: packageRoot,
    // Preserve `process.env.NODE_ENV` verbatim in the emitted library code instead of letting
    // Vite fold it to "production" (its build-mode default). These are libraries: the dev-only
    // diagnostics guarded by `process.env.NODE_ENV !== "production"` (and React's own such guards)
    // must survive in dist so the CONSUMER's bundler decides — dev builds keep the diagnostics,
    // production builds dead-code-eliminate them. The self-referential define overrides Vite's
    // implicit replacement; esbuild substitutes it once (a no-op), leaving the runtime token.
    define: {
      "process.env.NODE_ENV": "process.env.NODE_ENV",
    },
    css: {
      transformer: "lightningcss",
      lightningcss: { targets: cssTargets },
    },
    build: {
      emptyOutDir: false,
      minify: "esbuild",
      cssMinify: "lightningcss",
      outDir: outRoot,
      sourcemap: true,
      target: "es2022",
      cssCodeSplit: true,
      rollupOptions: {
        input: sources,
        preserveEntrySignatures: "strict",
        output: {
          dir: outRoot,
          format: "es",
          preserveModules: true,
          preserveModulesRoot: srcRoot,
          entryFileNames: "[name].js",
          assetFileNames: getAssetFileName,
        },
        external: externalizeModule,
        treeshake: false,
      },
    },
    resolve: {
      alias: workspaceSourceAliases,
    },
    plugins: [
      {
        name: "shared-lib-copy-static-assets",
        async generateBundle() {
          await Promise.all(
            copiedAssets.map(async (assetPath) => {
              const sourceText = await readFile(assetPath, "utf8");
              const outputPath = getCopiedAssetOutputPath(assetPath, srcRoot);

              this.emitFile({
                type: "asset",
                fileName: outputPath,
                source: sourceText,
              });
              this.emitFile({
                type: "asset",
                fileName: `${outputPath}.d.ts`,
                source: createJsonModuleDeclarationSource(sourceText),
              });
            }),
          );
        },
      },
      {
        name: "shared-lib-prune-output",
        async writeBundle(_options, bundle) {
          if (watchMode) {
            return;
          }

          const preservedArtifacts = new Set(
            Object.keys(bundle).map((fileName) => resolve(outRoot, fileName)),
          );
          await pruneOrphanedArtifacts(srcRoot, outRoot, new Set(sources), {
            includeDeclarations: true,
            preservedArtifacts,
          });
        },
      },
      wyw(wywOptions),
    ],
  };

  return config;
});
