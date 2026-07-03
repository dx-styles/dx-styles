import type {} from "@wyw-in-js/shared";

/**
 * Option types for dx-styles's WyW processors.
 *
 * dx-styles namespaces its processor options under the `dxStyles` key inside WyW's
 * processor-options bag, e.g.:
 *
 *   wyw({ processors: { dxStyles: { minifyClassNames: true } } })
 *
 * The processors read it back from `this.options.processors.dxStyles`.
 */
export interface DxStylesProcessorOptions {
  /**
   * Collapse recipe/slotRecipe scoped class names to short deterministic hashes
   * instead of the verbose length-prefixed hex segments. Off by default.
   */
  readonly minifyClassNames?: boolean;
}

declare module "@wyw-in-js/shared" {
  interface WywInJsProcessorOptions {
    dxStyles?: DxStylesProcessorOptions;
  }
}
