import {
  buildTokenContract,
  cloneStyleObject,
  createRuntimeClassName,
  createStyleHandleRegistry,
  DX_STYLES_DESCRIPTOR_KEY,
  flattenContractAssignments,
  type StyleObject,
  type TokenContractObject,
} from "./style-primitives.js";

interface PreevalMetadata {
  readonly className: string;
  readonly extends: null;
}

interface PreevalCssValue {
  readonly [DX_STYLES_DESCRIPTOR_KEY]: {
    readonly className: string;
    readonly classNameRefs: readonly string[];
    readonly kind: "css";
    readonly style: StyleObject;
  };
  readonly __wyw_meta: PreevalMetadata;
}

interface PreevalThemeValue {
  readonly [DX_STYLES_DESCRIPTOR_KEY]: {
    readonly assignments: Record<string, number | string>;
    readonly className: string;
    readonly kind: "theme";
  };
  readonly __wyw_meta: PreevalMetadata;
}

const preevalStyleHandleRegistry = createStyleHandleRegistry();

export function preevalCss(...parts: readonly unknown[]): PreevalCssValue {
  const classNameRefs = preevalStyleHandleRegistry.collectStyleHandleClassNames(parts);
  const style = preevalStyleHandleRegistry.normalizeStyleParts(parts);
  const className = createRuntimeClassName("dxs", style);
  preevalStyleHandleRegistry.registerStyle(className, cloneStyleObject(style));

  return {
    [DX_STYLES_DESCRIPTOR_KEY]: {
      className,
      classNameRefs,
      kind: "css",
      style,
    },
    __wyw_meta: {
      className,
      extends: null,
    },
  };
}

export function preevalRecipe(config: unknown): {
  readonly [DX_STYLES_DESCRIPTOR_KEY]: { readonly config: unknown; readonly kind: "recipe" };
} {
  return {
    [DX_STYLES_DESCRIPTOR_KEY]: {
      config,
      kind: "recipe",
    },
  };
}

export function preevalSlotRecipe(config: unknown): {
  readonly [DX_STYLES_DESCRIPTOR_KEY]: { readonly config: unknown; readonly kind: "slotRecipe" };
} {
  return {
    [DX_STYLES_DESCRIPTOR_KEY]: {
      config,
      kind: "slotRecipe",
    },
  };
}

export function preevalCreateTheme(contract: unknown, values: unknown): PreevalThemeValue {
  const assignments = flattenContractAssignments(contract, values, false);
  const className = createRuntimeClassName("dxt", assignments);

  return {
    [DX_STYLES_DESCRIPTOR_KEY]: {
      assignments,
      className,
      kind: "theme",
    },
    __wyw_meta: {
      className,
      extends: null,
    },
  };
}

export function preevalCreateTokenContract(
  shape: unknown,
  options: undefined | { readonly prefix: string },
): TokenContractObject {
  return buildTokenContract(shape, options);
}
