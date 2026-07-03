import type {
  ContractShape,
  ContractValues,
  CssClassName,
  PartialContractValues,
  Recipe,
  RecipeConfig,
  RecipeStyleHandles,
  SlotRecipe,
  SlotRecipeConfig,
  SlotRecipeStyleHandles,
  SlotVariantDefinitions,
  StyleHandle,
  StylePart,
  TokenContract,
  VariantDefinitions,
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
} from "./internal";
import { createRuntimeRecipe, createRuntimeSlotRecipe } from "./runtime";

export type { DxStylesProcessorOptions } from "./wyw-options";
export type {
  ContractShape,
  ContractValues,
  CssClassName,
  PartialContractValues,
  Recipe,
  RecipeConfig,
  RecipeStyleHandles,
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
