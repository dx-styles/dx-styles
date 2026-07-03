import { stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "vite";

import {
  collectSources,
  collectWatchInputs,
  loadPackageBuildOptions,
  type PackageBuildOptions,
  pruneOrphanedArtifacts,
  resolvePackageBuildPaths,
} from "./vite-lib-build";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const configPath = resolve(scriptDir, "vite-lib-build.ts");

export async function createWatchSnapshot(
  packageRoot: string,
  outRoot: string,
  configFilePath: string,
  sourceOptions: PackageBuildOptions = {},
): Promise<string> {
  const watchedInputs = await collectWatchInputs(packageRoot, {
    ignoredFiles: sourceOptions.ignoredWatchFiles,
    ignoredDirectories: [outRoot, resolve(packageRoot, "node_modules")],
  });
  const watchedFiles = [...new Set([...watchedInputs, configFilePath])].sort();
  const stats = await Promise.all(
    watchedFiles.map(async (filePath) => {
      try {
        const fileStats = await stat(filePath);
        return `${filePath}:${fileStats.mtimeMs}:${fileStats.size}`;
      } catch {
        return `${filePath}:missing`;
      }
    }),
  );

  return stats.join("|");
}

export function collectBuildArtifacts(
  buildResult: Awaited<ReturnType<typeof build>>,
  outRoot: string,
): ReadonlySet<string> {
  const outputs = Array.isArray(buildResult) ? buildResult : [buildResult];
  const artifactPaths = new Set<string>();

  for (const output of outputs) {
    if (!("output" in output) || !Array.isArray(output.output)) {
      continue;
    }

    for (const item of output.output) {
      if (typeof item.fileName === "string") {
        artifactPaths.add(resolve(outRoot, item.fileName));
      }
    }
  }

  return artifactPaths;
}

export async function runWatchBuildCycle(
  state: { knownSources: ReadonlySet<string> },
  options: {
    readonly srcRoot: string;
    readonly outRoot: string;
    readonly sourceOptions?: PackageBuildOptions;
    readonly buildProject: () => Promise<ReadonlySet<string>>;
  },
): Promise<boolean> {
  try {
    const nextSources = new Set(await collectSources(options.srcRoot, options.sourceOptions));
    const preservedArtifacts = await options.buildProject();
    await pruneOrphanedArtifacts(options.srcRoot, options.outRoot, nextSources, {
      includeDeclarations: true,
      obsoleteArtifactSuffixes: options.sourceOptions?.obsoleteArtifactSuffixes,
      preservedArtifacts,
    });
    state.knownSources = nextSources;
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

export async function startWatchBuild(
  packageRootInput = process.env.SHARED_LIB_BUILD_PACKAGE_ROOT ?? process.cwd(),
) {
  const packageRoot = resolve(packageRootInput);
  process.env.SHARED_LIB_BUILD_PACKAGE_ROOT = packageRoot;
  process.env.SHARED_LIB_BUILD_WATCH = "true";

  const { outRoot, srcRoot } = resolvePackageBuildPaths(packageRoot);
  let sourceOptions = await loadPackageBuildOptions(packageRoot);
  let knownSources = new Set(await collectSources(srcRoot, sourceOptions));
  let buildInFlight = false;
  let buildQueued = false;
  let buildTimer: NodeJS.Timeout | undefined;
  let snapshotCheckInFlight = false;
  let lastSnapshot = await createWatchSnapshot(packageRoot, outRoot, configPath, sourceOptions);

  async function runBuild() {
    if (buildInFlight) {
      buildQueued = true;
      return;
    }

    buildInFlight = true;

    try {
      sourceOptions = await loadPackageBuildOptions(packageRoot);
      const state = { knownSources };
      const success = await runWatchBuildCycle(state, {
        srcRoot,
        outRoot,
        sourceOptions,
        buildProject: async () =>
          collectBuildArtifacts(await build({ configFile: configPath }), outRoot),
      });

      if (success) {
        knownSources = new Set(state.knownSources);
      }
    } finally {
      buildInFlight = false;

      if (buildQueued) {
        buildQueued = false;
        void runBuild();
      }
    }
  }

  function scheduleBuild() {
    if (buildTimer !== undefined) {
      clearTimeout(buildTimer);
    }

    buildTimer = setTimeout(() => {
      buildTimer = undefined;
      void runBuild();
    }, 50);
  }

  const checkWatchSnapshot = async (): Promise<void> => {
    if (snapshotCheckInFlight) {
      return;
    }

    snapshotCheckInFlight = true;

    try {
      const nextSourceOptions = await loadPackageBuildOptions(packageRoot);
      const nextSnapshot = await createWatchSnapshot(
        packageRoot,
        outRoot,
        configPath,
        nextSourceOptions,
      );

      if (nextSnapshot !== lastSnapshot) {
        sourceOptions = nextSourceOptions;
        lastSnapshot = nextSnapshot;
        scheduleBuild();
      }
    } finally {
      snapshotCheckInFlight = false;
    }
  };

  const pollingInterval = setInterval(() => {
    void checkWatchSnapshot();
  }, 250);

  const shutdown = () => {
    clearInterval(pollingInterval);
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await runBuild();
  await new Promise(() => {});
}

if (import.meta.main) {
  await startWatchBuild();
}
