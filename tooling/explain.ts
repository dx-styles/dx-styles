import { readFile } from "node:fs/promises";

import {
  type DxStylesExplainEntry,
  type DxStylesExplainVariantPath,
  findDxStylesExplainPayload,
} from "../processors/explain-schema.ts";

interface DxStylesLocation {
  readonly column: number;
  readonly line: number;
}

interface DxStylesRule {
  readonly className: string;
  readonly cssText: string;
  readonly displayName: string;
  readonly start: DxStylesLocation | null | undefined;
}

interface DxStylesTransformProcessorMetadata {
  readonly artifacts: readonly (readonly [string, unknown])[];
  readonly className: string;
  readonly displayName: string;
  readonly start: DxStylesLocation | null | undefined;
}

export interface DxStylesTransformResultMetadata {
  readonly dependencies: readonly string[];
  readonly processors: readonly DxStylesTransformProcessorMetadata[];
  readonly replacements: readonly unknown[];
  readonly rules: Readonly<Record<string, DxStylesRule>>;
}

export interface DxStylesExplainManifest extends DxStylesTransformResultMetadata {
  readonly cssFile?: string;
  readonly source: string;
  readonly version: 1;
}

interface DxStylesComposeEdge {
  readonly className?: string;
  readonly node?: DxStylesExplainEntry["node"];
  readonly reference: string;
  readonly reason?: "ambiguous" | "missing";
  readonly source?: string;
  readonly symbol?: string;
  readonly unresolved: boolean;
}

export type DxStylesExplainRecord = DxStylesExplainEntry & {
  readonly compose: readonly DxStylesComposeEdge[];
  readonly cssFile?: string;
  readonly cssText?: string;
  readonly selector?: string;
  readonly source: string;
  readonly start: DxStylesLocation | null;
  readonly symbol: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDxStylesLocation(value: unknown): value is DxStylesLocation {
  return isRecord(value) && typeof value.column === "number" && typeof value.line === "number";
}

function isDxStylesRule(value: unknown): value is DxStylesRule {
  return (
    isRecord(value) &&
    typeof value.className === "string" &&
    typeof value.cssText === "string" &&
    typeof value.displayName === "string" &&
    (value.start === undefined || value.start === null || isDxStylesLocation(value.start))
  );
}

function isDxStylesTransformProcessorMetadata(
  value: unknown,
): value is DxStylesTransformProcessorMetadata {
  return (
    isRecord(value) &&
    Array.isArray(value.artifacts) &&
    value.artifacts.every(
      (artifact) =>
        Array.isArray(artifact) && artifact.length === 2 && typeof artifact[0] === "string",
    ) &&
    typeof value.className === "string" &&
    typeof value.displayName === "string" &&
    (value.start === undefined || value.start === null || isDxStylesLocation(value.start))
  );
}

export function isDxStylesExplainManifest(value: unknown): value is DxStylesExplainManifest {
  return (
    isRecord(value) &&
    value.version === 1 &&
    typeof value.source === "string" &&
    (value.cssFile === undefined || typeof value.cssFile === "string") &&
    Array.isArray(value.dependencies) &&
    value.dependencies.every((dependency) => typeof dependency === "string") &&
    Array.isArray(value.processors) &&
    value.processors.every(isDxStylesTransformProcessorMetadata) &&
    Array.isArray(value.replacements) &&
    isRecord(value.rules) &&
    Object.values(value.rules).every(isDxStylesRule)
  );
}

export function createDxStylesExplainManifest(
  metadata: DxStylesTransformResultMetadata,
  context: Pick<DxStylesExplainManifest, "cssFile" | "source">,
): DxStylesExplainManifest {
  return {
    ...metadata,
    ...context,
    version: 1,
  };
}

function formatVariantPath(variant: undefined | DxStylesExplainVariantPath): null | string {
  if (variant === undefined) {
    return null;
  }

  return `${variant.axis}=${variant.value}`;
}

function formatMatches(matches: undefined | Record<string, string>): null | string {
  if (matches === undefined) {
    return null;
  }

  return Object.entries(matches)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([axis, value]) => `${axis}=${value}`)
    .join(", ");
}

function formatLocation(location: DxStylesLocation | null | undefined): null | string {
  if (location === undefined || location === null) {
    return null;
  }

  return `${location.line}:${location.column}`;
}

function hasPreevalClassName(
  record: DxStylesExplainRecord,
): record is DxStylesExplainRecord & { readonly preevalClassName: string } {
  return "preevalClassName" in record && typeof record.preevalClassName === "string";
}

// wyw-in-js (through at least 2.4.1) hardcodes `rules: {}` on the transform
// metadata that the stock @wyw-in-js/vite plugin serializes into
// `.wyw-in-js.json`; the populated selector-keyed rules exist only on the
// top-level transform result, which never reaches the manifest. The same rules
// are still recoverable from each processor's ["css", [rules, replacements]]
// artifact — the exact source the extract stage merges them from.
function collectDxStylesArtifactRules(
  processors: readonly DxStylesTransformProcessorMetadata[],
): Record<string, DxStylesRule> {
  const rules: Record<string, DxStylesRule> = {};

  processors.forEach((processor) => {
    processor.artifacts.forEach(([kind, data]) => {
      if (kind !== "css" || !Array.isArray(data)) {
        return;
      }

      const [ruleset] = data as readonly unknown[];
      if (!isRecord(ruleset)) {
        return;
      }

      Object.entries(ruleset).forEach(([selector, rule]) => {
        if (isDxStylesRule(rule)) {
          rules[selector] = rule;
        }
      });
    });
  });

  return rules;
}

export function createDxStylesExplainIndex(
  manifest: DxStylesExplainManifest,
): Map<string, readonly DxStylesExplainRecord[]> {
  const rules = {
    ...collectDxStylesArtifactRules(manifest.processors),
    ...manifest.rules,
  };
  const rulesByClassName = new Map(
    Object.entries(rules).map(
      ([selector, rule]) => [rule.className, { rule, selector }] as const,
    ),
  );
  const records: DxStylesExplainRecord[] = manifest.processors.flatMap((processor) => {
    const payload = findDxStylesExplainPayload(processor.artifacts);
    if (payload === null) {
      return [];
    }

    return payload.entries.map((entry) => {
      const resolvedRule = rulesByClassName.get(entry.className);

      return {
        ...entry,
        compose: [],
        cssFile: manifest.cssFile,
        cssText: resolvedRule?.rule.cssText,
        selector: resolvedRule?.selector,
        source: manifest.source,
        start: processor.start ?? resolvedRule?.rule.start ?? null,
        symbol: processor.displayName,
      };
    });
  });
  const preevalLookup = new Map<string, DxStylesExplainRecord[]>();

  records.forEach((record) => {
    if (!hasPreevalClassName(record)) {
      return;
    }

    const bucket = preevalLookup.get(record.preevalClassName);

    if (bucket === undefined) {
      preevalLookup.set(record.preevalClassName, [record]);
      return;
    }

    bucket.push(record);
  });

  const recordsByClassName = new Map<string, DxStylesExplainRecord[]>();
  records.forEach((record) => {
    const resolvedRecord: DxStylesExplainRecord = {
      ...record,
      compose: record.composeRefs.map((reference) => {
        const composeTargets = preevalLookup.get(reference);

        if (composeTargets === undefined) {
          return {
            reference,
            reason: "missing" as const,
            unresolved: true,
          };
        }

        if (composeTargets.length !== 1) {
          return {
            reference,
            reason: "ambiguous" as const,
            unresolved: true,
          };
        }

        const [composeTarget] = composeTargets;

        return {
          className: composeTarget.className,
          node: composeTarget.node,
          reference,
          source: composeTarget.source,
          symbol: composeTarget.symbol,
          unresolved: false,
        };
      }),
    };
    const bucket = recordsByClassName.get(record.className);

    if (bucket === undefined) {
      recordsByClassName.set(record.className, [resolvedRecord]);
      return;
    }

    bucket.push(resolvedRecord);
  });

  return recordsByClassName;
}

function formatExplainRecord(record: DxStylesExplainRecord): string {
  const lines = [record.className];
  const location = formatLocation(record.start);

  lines.push(`  symbol: ${record.symbol}`);
  lines.push(`  source: ${location === null ? record.source : `${record.source}:${location}`}`);
  lines.push(`  kind: ${record.kind}`);
  lines.push(`  node: ${record.node}`);

  if (record.node === "variant") {
    const variant = formatVariantPath(record.variant);
    if (variant !== null) {
      lines.push(`  variant: ${variant}`);
    }
  }

  if ("slot" in record) {
    lines.push(`  slot: ${record.slot}`);
  }

  if (record.node === "compound") {
    const matches = formatMatches(record.matches);
    if (matches !== null) {
      lines.push(`  matches: ${matches}`);
    }
  }

  if (record.kind === "theme" && record.variables.length > 0) {
    lines.push(`  variables: ${record.variables.join(", ")}`);
  }

  if (record.kind === "keyframes" && record.frames.length > 0) {
    lines.push(`  frames: ${record.frames.join(" | ")}`);
  }

  if (record.selector !== undefined) {
    lines.push(`  selector: ${record.selector}`);
  }

  if (record.cssFile !== undefined) {
    lines.push(`  css file: ${record.cssFile}`);
  }

  if (record.cssText !== undefined) {
    lines.push(`  css: ${record.cssText}`);
  }

  if (record.compose.length === 0) {
    lines.push("  compose: none");
  } else {
    record.compose.forEach((compose) => {
      if (compose.unresolved) {
        lines.push(`  compose: ${compose.reference} (${compose.reason ?? "unresolved"})`);
        return;
      }

      const target = compose.className ?? compose.reference;
      const symbol = compose.symbol ?? "unknown";
      const source = compose.source ?? "unknown";
      const node = compose.node === undefined ? "" : ` ${compose.node}`;
      lines.push(`  compose: ${target} <= ${symbol}${node} (${source})`);
    });
  }

  return lines.join("\n");
}

export function formatDxStylesExplainReport(
  manifest: DxStylesExplainManifest,
  queries: readonly string[],
): string {
  const index = createDxStylesExplainIndex(manifest);
  const tokens = queries.flatMap((query) =>
    query.split(/\s+/u).filter((token) => token.length > 0),
  );

  return tokens
    .map((token) => {
      const records = index.get(token);

      if (records === undefined) {
        return `${token}\n  status: not found`;
      }

      return records.map(formatExplainRecord).join("\n");
    })
    .join("\n\n");
}

async function main(argv: readonly string[]): Promise<number> {
  if (argv.length < 2) {
    process.stderr.write("Usage: bun run explain -- <manifest.wyw-in-js.json> <className...>\n");
    return 1;
  }

  const [manifestPath, ...queries] = argv;

  const manifestValue: unknown = JSON.parse(await readFile(manifestPath, "utf8"));
  if (!isDxStylesExplainManifest(manifestValue)) {
    process.stderr.write(`Invalid dx-styles explain manifest: ${manifestPath}\n`);
    return 1;
  }

  const explainIndex = createDxStylesExplainIndex(manifestValue);
  const report = formatDxStylesExplainReport(manifestValue, queries);
  const tokens = queries.flatMap((query) =>
    query.split(/\s+/u).filter((token) => token.length > 0),
  );
  const hasMissingClasses = tokens.some((token) => !explainIndex.has(token));

  process.stdout.write(`${report}\n`);
  return hasMissingClasses ? 1 : 0;
}

if (import.meta.main) {
  const exitCode = await main(process.argv.slice(2));
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}
