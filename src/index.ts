import type {
  ContractShape,
  ContractValues,
  CssClassName,
  KeyframesConfig,
  KeyframesName,
  PartialContractValues,
  Recipe,
  RecipeConfig,
  RecipeStyleHandles,
  SlotRecipe,
  SlotRecipeConfig,
  SlotRecipeStyleHandles,
  SlotVariantDefinitions,
  SlotVariantSelection,
  StyleHandle,
  StylePart,
  TokenContract,
  VariantDefinitions,
  VariantSelection,
} from "./internal";
import {
  assignVars as assignVarsRuntime,
  compileRuntimeRecipeDefinition,
  compileRuntimeSlotRecipeDefinition,
  createRecipeStyleHandles as createRecipeStyleHandlesRuntime,
  createSlotRecipeStyleHandles as createSlotRecipeStyleHandlesRuntime,
  createStyleHandle as createStyleHandleRuntime,
  createThemeDescriptor,
  createTokenContract as createTokenContractRuntime,
  css as cssRuntime,
  cx,
  getDescriptorClassName,
  keyframes as keyframesRuntime,
  splitRecipeProps as splitRecipePropsRuntime,
  splitSlotRecipeProps as splitSlotRecipePropsRuntime,
} from "./internal";
import { createRuntimeRecipe, createRuntimeSlotRecipe } from "./runtime";

export type { DxStylesProcessorOptions } from "./wyw-options";
export type {
  ContractShape,
  ContractValues,
  CssClassName,
  KeyframeFrame,
  KeyframesConfig,
  KeyframesName,
  PartialContractValues,
  Recipe,
  RecipeConfig,
  RecipeStyleHandles,
  RecipeVariantProps,
  SlotRecipe,
  SlotRecipeConfig,
  SlotRecipeStyleHandles,
  SlotVariantSelection,
  StyleHandle,
  StyleObject,
  StylePart,
  TokenContract,
  VariantSelection,
} from "./internal";
export type { CssVar } from "./internal";
export { createVar, setVar, varName } from "./internal";

/**
 * Composes statically analyzable style parts into a deterministic class name.
 */
export function css(...parts: StylePart[]): CssClassName {
  return cssRuntime(...parts);
}

/**
 * Declares a shareable @keyframes animation and returns its deterministic name.
 *
 * The name is a plain string value: use it as `animationName` or inside an
 * `animation` shorthand, across files, recipes, and theme values.
 */
export function keyframes(frames: KeyframesConfig): KeyframesName {
  return keyframesRuntime(frames);
}

/**
 * Defines a variant-driven runtime selector over statically compiled class groups.
 */
export function recipe<TVariants extends VariantDefinitions>(
  config: RecipeConfig<TVariants>,
): Recipe<TVariants> {
  return createRuntimeRecipe(compileRuntimeRecipeDefinition(config)) as Recipe<TVariants>;
}

/**
 * Defines a slot-based variant selector over statically compiled class groups.
 */
export function slotRecipe<
  TSlot extends string,
  TVariants extends SlotVariantDefinitions<TSlot> = SlotVariantDefinitions<TSlot>,
>(config: SlotRecipeConfig<TSlot, TVariants>): SlotRecipe<TSlot, TVariants> {
  return createRuntimeSlotRecipe(compileRuntimeSlotRecipeDefinition(config)) as SlotRecipe<
    TSlot,
    TVariants
  >;
}

/**
 * Composes arbitrary class name inputs into a stable deduplicated string.
 */
export { cx };

/**
 * Splits recipe variant selections from the remaining component props.
 */
export function splitRecipeProps<TVariants extends VariantDefinitions, TProps extends object>(
  recipeValue: Recipe<TVariants>,
  props: TProps & VariantSelection<NoInfer<TVariants>>,
): {
  readonly otherProps: Omit<TProps, keyof VariantSelection<TVariants>>;
  readonly variantProps: VariantSelection<TVariants>;
} {
  return splitRecipePropsRuntime(recipeValue, props);
}

/**
 * Splits slot recipe variant selections from the remaining component props.
 */
export function splitSlotRecipeProps<
  TSlot extends string,
  TVariants extends SlotVariantDefinitions<TSlot>,
  TProps extends object,
>(
  recipeValue: SlotRecipe<TSlot, TVariants>,
  props: TProps & SlotVariantSelection<NoInfer<TVariants>>,
): {
  readonly otherProps: Omit<TProps, keyof SlotVariantSelection<TVariants>>;
  readonly variantProps: SlotVariantSelection<TVariants>;
} {
  return splitSlotRecipePropsRuntime(recipeValue, props);
}

/**
 * Creates a serializable style handle for public component extension entrypoints.
 *
 * Handles are accepted by `css(...)` as symbolic class references. The enumerable descriptor on
 * the handle is reserved for static extraction and must not be read or persisted by consumers.
 */
export function createStyleHandle(className: string): StyleHandle {
  return createStyleHandleRuntime(className);
}

/**
 * Creates public handles for a recipe root and variant classes.
 */
export function createRecipeStyleHandles<TVariants extends VariantDefinitions>(
  recipeValue: Recipe<TVariants>,
): RecipeStyleHandles {
  return createRecipeStyleHandlesRuntime(recipeValue);
}

/**
 * Creates public handles for a slot recipe base slots and variant classes.
 */
export function createSlotRecipeStyleHandles<
  TSlot extends string,
  TVariants extends SlotVariantDefinitions<TSlot>,
>(recipeValue: SlotRecipe<TSlot, TVariants>): SlotRecipeStyleHandles {
  return createSlotRecipeStyleHandlesRuntime(recipeValue);
}

/**
 * Creates a token contract backed by CSS custom properties using an explicit stable prefix.
 */
export function createTokenContract<TShape extends ContractShape>(
  shape: TShape,
  options: { readonly prefix: string },
): TokenContract<TShape> {
  return createTokenContractRuntime(shape, options);
}

/**
 * Creates a theme class for a token contract.
 */
export function createTheme<TShape extends ContractShape>(
  contract: TokenContract<TShape>,
  values: ContractValues<TShape>,
): string {
  return getDescriptorClassName(createThemeDescriptor(contract, values));
}

/**
 * Assigns runtime values to a token contract without generating new CSS rules.
 */
export function assignVars<TShape extends ContractShape>(
  contract: TokenContract<TShape>,
  values: PartialContractValues<TShape>,
): Record<string, string | number> {
  return assignVarsRuntime(contract, values);
}
