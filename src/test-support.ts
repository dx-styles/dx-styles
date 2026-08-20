import {
  assignVars as assignVarsRuntime,
  attachRuntimeRecipeDefinition,
  attachRuntimeSlotRecipeDefinition,
  compileRecipeDefinition,
  compileSlotRecipeDefinition,
  createCssDescriptor,
  createRecipeStyleHandles as createRecipeStyleHandlesRuntime,
  createSlotRecipeStyleHandles as createSlotRecipeStyleHandlesRuntime,
  createStyleHandle as createStyleHandleRuntime,
  createThemeDescriptor,
  createTokenContract as createTokenContractRuntime,
  cx,
  DX_STYLES_DESCRIPTOR_KEY,
  getDescriptorClassName,
  keyframes as keyframesRuntime,
  splitRecipeProps as splitRecipePropsRuntime,
  splitSlotRecipeProps as splitSlotRecipePropsRuntime,
  toCssClassName,
} from "./internal";
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
  SplitRecipePropsResult,
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
import { createRuntimeRecipe, createRuntimeSlotRecipe } from "./runtime";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Reflect.getPrototypeOf(value);
  return prototype === null || Reflect.getPrototypeOf(prototype) === null;
}

function readDescriptorStyle(value: unknown): null | Record<string, unknown> {
  if (!isPlainObject(value)) {
    return null;
  }

  const descriptor = Reflect.get(value, DX_STYLES_DESCRIPTOR_KEY);

  if (!isPlainObject(descriptor)) {
    return null;
  }

  const style = Reflect.get(descriptor, "style");

  return isPlainObject(style) ? style : null;
}

function compileClassName(part: StylePart): string {
  return getDescriptorClassName(createCssDescriptor(part));
}

export function css(...parts: StylePart[]): CssClassName {
  return getDescriptorClassName(createCssDescriptor(...parts));
}

export function keyframes(frames: KeyframesConfig): KeyframesName {
  return keyframesRuntime(frames);
}

export { cx };
export const cxTest = cx;

export function recipe<TVariants extends VariantDefinitions>(
  config: RecipeConfig<TVariants>,
): Recipe<TVariants> {
  const definition = compileRecipeDefinition(config, compileClassName);
  const runtimeRecipe = createRuntimeRecipe(definition);

  const testRecipe = (selection?: VariantSelection<TVariants>) => {
    const runtimeSelection: Record<string, string | undefined> | undefined =
      selection === undefined ? undefined : { ...selection };

    return runtimeRecipe(runtimeSelection);
  };

  return attachRuntimeRecipeDefinition(testRecipe, definition);
}

export function slotRecipe<
  TSlot extends string,
  TVariants extends SlotVariantDefinitions<TSlot> = SlotVariantDefinitions<TSlot>,
>(config: SlotRecipeConfig<TSlot, TVariants>): SlotRecipe<TSlot, TVariants> {
  const definition = compileSlotRecipeDefinition(config, compileClassName);
  const runtimeSlotRecipe = createRuntimeSlotRecipe(definition);

  const testSlotRecipe = (selection?: SlotVariantSelection<TVariants>) => {
    const runtimeSelection: Record<string, string | undefined> | undefined =
      selection === undefined ? undefined : { ...selection };

    return runtimeSlotRecipe(runtimeSelection);
  };

  return attachRuntimeSlotRecipeDefinition(testSlotRecipe, definition);
}

export function splitRecipeProps<TVariants extends VariantDefinitions, TProps extends object>(
  recipeValue: Recipe<TVariants>,
  props: TProps & VariantSelection<NoInfer<TVariants>>,
): SplitRecipePropsResult<VariantSelection<TVariants>, TProps> {
  return splitRecipePropsRuntime(recipeValue, props);
}

export function splitSlotRecipeProps<
  TSlot extends string,
  TVariants extends SlotVariantDefinitions<TSlot>,
  TProps extends object,
>(
  recipeValue: SlotRecipe<TSlot, TVariants>,
  props: TProps & SlotVariantSelection<NoInfer<TVariants>>,
): SplitRecipePropsResult<SlotVariantSelection<TVariants>, TProps> {
  return splitSlotRecipePropsRuntime(recipeValue, props);
}

export function createStyleHandle(className: string): StyleHandle {
  return createStyleHandleRuntime(className);
}

export function createRecipeStyleHandles<TVariants extends VariantDefinitions>(
  recipeValue: Recipe<TVariants>,
): RecipeStyleHandles {
  return createRecipeStyleHandlesRuntime(recipeValue);
}

export function createSlotRecipeStyleHandles<
  TSlot extends string,
  TVariants extends SlotVariantDefinitions<TSlot>,
>(recipeValue: SlotRecipe<TSlot, TVariants>): SlotRecipeStyleHandles {
  return createSlotRecipeStyleHandlesRuntime(recipeValue);
}

export function createTokenContract<TShape extends ContractShape>(
  shape: TShape,
  options: { readonly prefix: string },
): TokenContract<TShape> {
  return createTokenContractRuntime(shape, options);
}

export function createTheme<TShape extends ContractShape>(
  contract: TokenContract<TShape>,
  values: ContractValues<TShape>,
): string {
  return getDescriptorClassName(createThemeDescriptor(contract, values));
}

export function assignVars<TShape extends ContractShape>(
  contract: TokenContract<TShape>,
  values: PartialContractValues<TShape>,
): Record<string, string | number> {
  return assignVarsRuntime(contract, values);
}

export function resolveStyle(classNames: string): null | Record<string, unknown> {
  return readDescriptorStyle(createCssDescriptor(toCssClassName(classNames)));
}
