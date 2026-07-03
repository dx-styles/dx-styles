export type DxStylesExplainArtifactName = "dx-styles:explain";

export const DX_STYLES_EXPLAIN_ARTIFACT: DxStylesExplainArtifactName = "dx-styles:explain";

export interface DxStylesExplainVariantPath {
  readonly axis: string;
  readonly value: string;
}

export interface CssExplainEntry {
  readonly className: string;
  readonly composeRefs: readonly string[];
  readonly kind: "css";
  readonly node: "style";
  readonly preevalClassName: string;
}

export interface RecipeExplainEntry {
  readonly className: string;
  readonly composeRefs: readonly string[];
  readonly kind: "recipe";
  readonly matches?: Record<string, string>;
  readonly node: "base" | "compound" | "variant";
  readonly variant?: DxStylesExplainVariantPath;
}

export interface SlotRecipeExplainEntry {
  readonly className: string;
  readonly composeRefs: readonly string[];
  readonly kind: "slotRecipe";
  readonly matches?: Record<string, string>;
  readonly node: "base" | "compound" | "variant";
  readonly slot: string;
  readonly variant?: DxStylesExplainVariantPath;
}

export interface ThemeExplainEntry {
  readonly className: string;
  readonly composeRefs: readonly string[];
  readonly kind: "theme";
  readonly node: "theme";
  readonly preevalClassName: string;
  readonly variables: readonly string[];
}

export type DxStylesExplainEntry =
  | CssExplainEntry
  | RecipeExplainEntry
  | SlotRecipeExplainEntry
  | ThemeExplainEntry;

export interface DxStylesExplainPayload {
  readonly entries: readonly DxStylesExplainEntry[];
  readonly version: 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDxStylesExplainVariantPath(value: unknown): value is DxStylesExplainVariantPath {
  return isRecord(value) && typeof value.axis === "string" && typeof value.value === "string";
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === "string");
}

export function isDxStylesExplainEntry(value: unknown): value is DxStylesExplainEntry {
  if (
    !isRecord(value) ||
    typeof value.className !== "string" ||
    !Array.isArray(value.composeRefs) ||
    !value.composeRefs.every((entry) => typeof entry === "string")
  ) {
    return false;
  }

  switch (value.kind) {
    case "css":
      return (
        value.node === "style" &&
        typeof value.preevalClassName === "string" &&
        value.matches === undefined &&
        value.slot === undefined &&
        value.variables === undefined &&
        value.variant === undefined
      );

    case "theme":
      return (
        value.node === "theme" &&
        typeof value.preevalClassName === "string" &&
        Array.isArray(value.variables) &&
        value.variables.every((entry) => typeof entry === "string") &&
        value.matches === undefined &&
        value.slot === undefined &&
        value.variant === undefined
      );

    case "recipe":
      if (
        (value.node !== "base" && value.node !== "compound" && value.node !== "variant") ||
        value.preevalClassName !== undefined ||
        value.slot !== undefined ||
        value.variables !== undefined
      ) {
        return false;
      }

      if (value.node === "base") {
        return value.matches === undefined && value.variant === undefined;
      }

      if (value.node === "variant") {
        return value.matches === undefined && isDxStylesExplainVariantPath(value.variant);
      }

      return isStringRecord(value.matches) && value.variant === undefined;

    case "slotRecipe":
      if (
        (value.node !== "base" && value.node !== "compound" && value.node !== "variant") ||
        typeof value.slot !== "string" ||
        value.preevalClassName !== undefined ||
        value.variables !== undefined
      ) {
        return false;
      }

      if (value.node === "base") {
        return value.matches === undefined && value.variant === undefined;
      }

      if (value.node === "variant") {
        return value.matches === undefined && isDxStylesExplainVariantPath(value.variant);
      }

      return isStringRecord(value.matches) && value.variant === undefined;

    default:
      return false;
  }
}

export function isDxStylesExplainPayload(value: unknown): value is DxStylesExplainPayload {
  return (
    isRecord(value) &&
    value.version === 1 &&
    Array.isArray(value.entries) &&
    value.entries.every(isDxStylesExplainEntry)
  );
}

export function findDxStylesExplainPayload(
  artifacts: readonly (readonly [string, unknown])[],
): DxStylesExplainPayload | null {
  const explainArtifact = artifacts.find(([name]) => name === DX_STYLES_EXPLAIN_ARTIFACT);

  if (explainArtifact === undefined || !isDxStylesExplainPayload(explainArtifact[1])) {
    return null;
  }

  return explainArtifact[1];
}
