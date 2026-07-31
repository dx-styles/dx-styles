import type { PropertiesFallback } from "csstype";

import { DX_STYLES_DESCRIPTOR_KEY, STYLE_HANDLE_DESCRIPTOR_KIND } from "./style-handle-contract.js";
import { createStyleHandleRegistry, normalizeStyleHandleClassName } from "./style-handle-support";

export { DX_STYLES_DESCRIPTOR_KEY, STYLE_HANDLE_DESCRIPTOR_KIND } from "./style-handle-contract.js";

const WYW_META_KEY = "__wyw_meta";
const RECIPE_DEFINITION_KEY = Symbol.for("dx-styles.recipeDefinition");
const SLOT_RECIPE_DEFINITION_KEY = Symbol.for("dx-styles.slotRecipeDefinition");
const STYLE_HANDLE_BRAND: unique symbol = Symbol("dx-styles.styleHandle");
const HASH_MODULUS = 2147483647;
const HASH_MULTIPLIER = 33;
const HASH_SEED = 5381;
const CSS_CLASS_NAME_PREFIX = "dxs";

export type StylePrimitive = number | string;
export type StyleLeafValue = readonly StylePrimitive[] | StylePrimitive;
type StyleEntry = false | null | StyleLeafValue | StyleObject | true | undefined;

/**
 * Authoring shape of a style object.
 *
 * `PropertiesFallback` supplies the known CSS properties, so editors complete
 * property names and their values (and arrays stay legal as fallback values).
 * The `$rtl`/`$noflip` markers are declared explicitly so they are completed
 * too — `assertValidStyleEntry` rejects any value other than `true`. The string
 * index signature is the deliberate escape hatch: custom properties, nested
 * selectors, at-rules, and properties `csstype` does not know yet.
 */
export type StyleObject = PropertiesFallback<number | string> & {
  readonly $noflip?: true;
  readonly $rtl?: true;
} & {
  readonly [key: string]: StyleEntry;
};

export interface StyleDescriptorCarrier {
  readonly [DX_STYLES_DESCRIPTOR_KEY]?: unknown;
}

/**
 * A class name produced by `css()`, `recipe()`, or `slotRecipe()`.
 *
 * Modelled as a template literal rather than a `string & { brand }`
 * intersection on purpose. An intersection is an object type, so TypeScript
 * offers every `String` member as a completion inside any object literal
 * contextually typed by `StylePart` — which is what made IntelliSense inside
 * `css({ ... })` useless. A template literal is a plain string subtype: it
 * contributes no completions while still rejecting arbitrary strings, which
 * `resolveStylePart` throws on at runtime.
 */
export type CssClassName = `${typeof CSS_CLASS_NAME_PREFIX}_${string}`;

export interface StyleHandle extends StyleDescriptorCarrier {
  readonly [STYLE_HANDLE_BRAND]: "dx-styles-style-handle";
}

export type StylePart =
  | CssClassName
  | false
  | null
  | StyleHandle
  | StyleDescriptorCarrier
  | StyleObject
  | undefined;

export interface ContractShape {
  readonly [key: string]: ContractShape | null | string;
}

export type ContractValues<TShape> = {
  [TKey in keyof TShape]: TShape[TKey] extends Record<string, unknown>
    ? ContractValues<TShape[TKey]>
    : string | number;
};

export type PartialContractValues<TShape> = {
  [TKey in keyof TShape]?: TShape[TKey] extends Record<string, unknown>
    ? PartialContractValues<TShape[TKey]>
    : string | number;
};

export type TokenContract<TShape extends ContractShape> = {
  [TKey in keyof TShape]: TShape[TKey] extends ContractShape ? TokenContract<TShape[TKey]> : string;
};

type VariantAxisSelection<TVariants extends Record<string, Record<string, unknown>>> = {
  [TAxis in keyof TVariants]?: keyof TVariants[TAxis] & string;
};
export type VariantDefinitions = Record<string, Record<string, StylePart>>;
export type VariantSelection<TVariants extends VariantDefinitions> =
  VariantAxisSelection<TVariants>;
export type SlotVariantSelection<TVariants extends Record<string, Record<string, unknown>>> =
  VariantAxisSelection<TVariants>;
type CompoundVariantConfig<
  TVariants extends Record<string, Record<string, unknown>>,
  TCss,
> = Readonly<VariantAxisSelection<TVariants> & { css: TCss }>;

export interface RecipeConfig<TVariants extends VariantDefinitions = VariantDefinitions> {
  readonly base?: StylePart;
  readonly compoundVariants?: readonly CompoundVariantConfig<TVariants, StylePart>[];
  readonly defaultVariants?: VariantSelection<TVariants>;
  readonly variants?: TVariants;
}

export type SlotStyles<TSlot extends string> = Partial<Record<TSlot, StylePart>>;
export type SlotVariantDefinitions<TSlot extends string> = Record<
  string,
  Record<string, SlotStyles<TSlot>>
>;

export interface SlotRecipeConfig<
  TSlot extends string = string,
  TVariants extends SlotVariantDefinitions<TSlot> = SlotVariantDefinitions<TSlot>,
> {
  readonly slots: readonly TSlot[];
  readonly base?: SlotStyles<TSlot>;
  readonly compoundVariants?: readonly CompoundVariantConfig<TVariants, SlotStyles<TSlot>>[];
  readonly defaultVariants?: SlotVariantSelection<TVariants>;
  readonly variants?: TVariants;
}

interface RuntimeRecipeCompoundVariant {
  readonly className: string;
  readonly matches: Record<string, string>;
}

export interface RuntimeRecipeDefinition {
  readonly baseClassName?: string;
  readonly compoundVariants: readonly RuntimeRecipeCompoundVariant[];
  readonly defaultVariants: Record<string, string>;
  readonly variantOrder: readonly string[];
  readonly variants: Record<string, Record<string, string>>;
}

interface RuntimeSlotRecipeCompoundVariant<TSlot extends string> {
  readonly classNames: Record<TSlot, string>;
  readonly matches: Record<string, string>;
}

export interface RuntimeSlotRecipeDefinition<TSlot extends string = string> {
  readonly baseClassNames: Record<TSlot, string>;
  readonly compoundVariants: readonly RuntimeSlotRecipeCompoundVariant<TSlot>[];
  readonly defaultVariants: Record<string, string>;
  readonly slots: readonly TSlot[];
  readonly variantOrder: readonly string[];
  readonly variants: Record<string, Record<string, Record<TSlot, string>>>;
}

interface RuntimeRecipeDefinitionCarrier {
  readonly [RECIPE_DEFINITION_KEY]?: RuntimeRecipeDefinition;
}

interface RuntimeSlotRecipeDefinitionCarrier<TSlot extends string = string> {
  readonly [SLOT_RECIPE_DEFINITION_KEY]?: RuntimeSlotRecipeDefinition<TSlot>;
}

export type Recipe<TVariants extends VariantDefinitions = VariantDefinitions> = ((
  selection?: VariantSelection<TVariants>,
) => string) &
  RuntimeRecipeDefinitionCarrier;

export type SlotRecipe<
  TSlot extends string = string,
  TVariants extends SlotVariantDefinitions<TSlot> = SlotVariantDefinitions<TSlot>,
> = ((selection?: SlotVariantSelection<TVariants>) => Record<TSlot, string>) &
  RuntimeSlotRecipeDefinitionCarrier<TSlot>;

export type RecipeVariantProps<TRecipe> = TRecipe extends (selection?: infer TSelection) => unknown
  ? NonNullable<TSelection>
  : never;

export interface SplitRecipePropsResult<TVariantProps extends object, TProps extends object> {
  readonly otherProps: Omit<TProps, keyof TVariantProps>;
  readonly variantProps: TVariantProps;
}

export interface RecipeStyleHandles {
  readonly root: StyleHandle;
  readonly variants: Readonly<Record<string, Readonly<Record<string, StyleHandle>>>>;
}

export interface SlotRecipeStyleHandles {
  readonly slots: Readonly<Partial<Record<string, StyleHandle>>>;
  readonly variants: Readonly<
    Record<string, Readonly<Record<string, Readonly<Partial<Record<string, StyleHandle>>>>>>
  >;
}

interface PreevalMetadata {
  readonly className: string;
  readonly extends: null;
}

interface PreevalCssDescriptorPayload {
  readonly className: string;
  readonly classNameRefs: readonly string[];
  readonly kind: "css";
  readonly style: StyleObject;
}

export interface PreevalCssValue {
  readonly [DX_STYLES_DESCRIPTOR_KEY]: PreevalCssDescriptorPayload;
  readonly [WYW_META_KEY]: PreevalMetadata;
}

interface PreevalThemeDescriptorPayload {
  readonly assignments: Record<string, string | number>;
  readonly className: string;
  readonly kind: "theme";
}

export interface PreevalThemeValue {
  readonly [DX_STYLES_DESCRIPTOR_KEY]: PreevalThemeDescriptorPayload;
  readonly [WYW_META_KEY]: PreevalMetadata;
}

interface StyleHandlePayload {
  readonly className: string;
  readonly kind: typeof STYLE_HANDLE_DESCRIPTOR_KIND;
}

interface LooseCompoundVariant<TCss> {
  readonly css?: TCss;
  readonly [key: string]: unknown;
}

function recordEntries<TValue>(
  record: Readonly<Record<string, TValue>>,
): (readonly [string, TValue])[] {
  return Object.keys(record).map((key) => [key, record[key]] as const);
}

function setRecordEntry<TKey extends string, TValue>(
  record: Partial<Record<TKey, TValue>>,
  key: TKey,
  value: TValue,
): void {
  Object.defineProperty(record, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Reflect.getPrototypeOf(value);
  return prototype === null || Reflect.getPrototypeOf(prototype) === null;
}

function isStyleObject(value: unknown): value is StyleObject {
  return isPlainObject(value);
}

function isStylePrimitive(value: unknown): value is StylePrimitive {
  return typeof value === "number" || typeof value === "string";
}

function isStyleLeafArray(value: StyleEntry): value is readonly StylePrimitive[] {
  return Array.isArray(value) && value.every(isStylePrimitive);
}

export function readStyleHandleClassName(value: unknown): null | string {
  if (!isPlainObject(value)) {
    return null;
  }

  const descriptor = value[DX_STYLES_DESCRIPTOR_KEY];
  if (
    !isPlainObject(descriptor) ||
    descriptor.kind !== STYLE_HANDLE_DESCRIPTOR_KIND ||
    typeof descriptor.className !== "string"
  ) {
    return null;
  }

  return descriptor.className;
}

function hasDxStylesDescriptorKey(value: unknown): boolean {
  return isPlainObject(value) && Object.hasOwn(value, DX_STYLES_DESCRIPTOR_KEY);
}

function assertValidStyleEntry(key: string, value: StyleEntry): void {
  if (key.includes("[object Object]")) {
    throw new Error(
      `dx-styles style key "${key}" contains "[object Object]"; class values cannot be interpolated into selector keys. Use slotRecipe() or a literal class/data-attribute selector instead — see docs/migration.`,
    );
  }

  if (key === "$rtl" || key === "$noflip") {
    if (value !== true) {
      throw new Error(`dx-styles ${key} marker only accepts true.`);
    }

    return;
  }

  if (value === true) {
    throw new Error(
      `dx-styles style property "${key}" cannot be true; only $rtl and $noflip use boolean markers.`,
    );
  }

  if (readStyleHandleClassName(value) !== null) {
    throw new Error(
      `dx-styles style property "${key}" cannot reference a style handle; compose handles with css(handle, { ... }) instead.`,
    );
  }

  if (hasDxStylesDescriptorKey(value)) {
    throw new Error(
      `dx-styles style property "${key}" cannot embed a css()/recipe()/createTheme() result; compose class results as top-level css() parts instead.`,
    );
  }

  if (Array.isArray(value) && !isStyleLeafArray(value)) {
    throw new Error(`dx-styles style property "${key}" cannot use non-primitive array values.`);
  }

  if (
    value !== undefined &&
    value !== null &&
    value !== false &&
    !isStylePrimitive(value) &&
    !isStyleLeafArray(value) &&
    !isStyleObject(value)
  ) {
    throw new Error(
      `dx-styles style property "${key}" must be a primitive, primitive array, or nested style object.`,
    );
  }
}

function readCssDescriptorStyle(value: unknown): null | StyleObject {
  if (!isPlainObject(value)) {
    return null;
  }

  const descriptor = value[DX_STYLES_DESCRIPTOR_KEY];
  if (!isPlainObject(descriptor) || descriptor.kind !== "css" || !isStyleObject(descriptor.style)) {
    return null;
  }

  return descriptor.style;
}

function readCssDescriptorClassNameRefs(value: unknown): readonly string[] {
  if (!isPlainObject(value)) {
    return [];
  }

  const descriptor = value[DX_STYLES_DESCRIPTOR_KEY];
  if (!isPlainObject(descriptor) || descriptor.kind !== "css") {
    return [];
  }

  const { classNameRefs } = descriptor;
  return Array.isArray(classNameRefs)
    ? classNameRefs.filter((className): className is string => typeof className === "string")
    : [];
}

function isCssDescriptor(value: unknown): value is PreevalCssValue {
  return readCssDescriptorStyle(value) !== null;
}

function cloneStyleObject(style: StyleObject): StyleObject {
  return recordEntries(style).reduce<Record<string, StyleEntry>>((acc, [key, value]) => {
    assertValidStyleEntry(key, value);

    let nextValue: StyleEntry = value;

    if (isStyleLeafArray(value)) {
      nextValue = [...value];
    } else if (isStyleObject(value)) {
      nextValue = cloneStyleObject(value);
    }

    return {
      ...acc,
      [key]: nextValue,
    };
  }, {});
}

function mergeStyleObjects(base: StyleObject, next: StyleObject): StyleObject {
  return recordEntries(next).reduce((acc, [key, value]) => {
    assertValidStyleEntry(key, value);

    if (value === undefined || value === null || value === false) {
      return acc;
    }

    const current = acc[key];
    let nextValue: Exclude<StyleEntry, false | null | undefined> = value;

    if (isStyleObject(current) && isStyleObject(value)) {
      nextValue = mergeStyleObjects(current, value);
    } else if (isStyleLeafArray(value)) {
      nextValue = [...value];
    } else if (isStyleObject(value)) {
      nextValue = cloneStyleObject(value);
    }

    return {
      ...acc,
      [key]: nextValue,
    };
  }, cloneStyleObject(base));
}

function resolveStylePart(
  part: unknown,
  readToken: (token: string) => null | StyleObject,
): StyleObject {
  if (part === undefined || part === null || part === false) {
    return {};
  }

  if (typeof part === "string") {
    const styles = part
      .split(/\s+/u)
      .filter((token) => token.length > 0)
      .map(readToken);

    if (styles.some((style) => style === null)) {
      throw new Error(
        "dx-styles css() supports only previously declared css() results for string composition.",
      );
    }

    return styles.reduce<StyleObject>((acc, value) => mergeStyleObjects(acc, value ?? {}), {});
  }

  if (readStyleHandleClassName(part) !== null) {
    return {};
  }

  if (isCssDescriptor(part)) {
    return cloneStyleObject(part[DX_STYLES_DESCRIPTOR_KEY].style);
  }

  if (hasDxStylesDescriptorKey(part)) {
    throw new Error(
      "dx-styles css() supports only style objects and previously declared css() results.",
    );
  }

  if (isStyleObject(part)) {
    return cloneStyleObject(part);
  }

  throw new Error(
    "dx-styles css() supports only style objects and previously declared css() results.",
  );
}

const runtimeStyleHandleRegistry = createStyleHandleRegistry<StyleObject>({
  cloneStyle: cloneStyleObject,
  createEmptyStyle: () => ({}),
  normalizeStyleParts(parts, readToken) {
    return parts.reduce<StyleObject>(
      (acc, part) => mergeStyleObjects(acc, resolveStylePart(part, readToken)),
      {},
    );
  },
  readCssDescriptorClassNameRefs,
  readStyleHandleClassName,
});

export function normalizeStyleParts(parts: readonly StylePart[]): StyleObject {
  return runtimeStyleHandleRegistry.normalizeStyleParts(parts);
}

export function collectStyleHandleClassNames(parts: readonly StylePart[]): string[] {
  return runtimeStyleHandleRegistry.collectStyleHandleClassNames(parts);
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort((left, right) => left.localeCompare(right));

    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

export function hashString(source: string): string {
  const hash = source.split("").reduce((acc, character) => {
    return (acc * HASH_MULTIPLIER + character.charCodeAt(0)) % HASH_MODULUS;
  }, HASH_SEED);

  return hash.toString(36);
}

export function cx(...classNames: readonly (false | null | string | undefined)[]): string {
  const tokens = classNames.flatMap((token) => {
    return typeof token === "string"
      ? token.split(/\s+/u).filter((className) => className.length > 0)
      : [];
  });

  return Array.from(new Set(tokens)).join(" ");
}

export function toCssClassName(value: string): CssClassName {
  const normalizedClassName = cx(value);

  if (normalizedClassName.length === 0) {
    throw new Error("dx-styles css() produced an invalid class name.");
  }

  return normalizedClassName as CssClassName;
}

export function createRuntimeClassName(prefix: string, value: unknown): string {
  return `${prefix}_${hashString(stableStringify(value))}`;
}

export function getDescriptorClassName(value: PreevalCssValue): CssClassName;
export function getDescriptorClassName(value: PreevalThemeValue): string;
export function getDescriptorClassName(value: PreevalCssValue | PreevalThemeValue): string {
  return value[WYW_META_KEY].className;
}

export function createCssDescriptor(...parts: StylePart[]): PreevalCssValue {
  const classNameRefs = collectStyleHandleClassNames(parts);
  const style = normalizeStyleParts(parts);
  const className = toCssClassName(createRuntimeClassName(CSS_CLASS_NAME_PREFIX, style));

  runtimeStyleHandleRegistry.registerStyle(className, style);

  return {
    [DX_STYLES_DESCRIPTOR_KEY]: {
      className,
      classNameRefs,
      kind: "css",
      style,
    },
    [WYW_META_KEY]: {
      className,
      extends: null,
    },
  };
}

function normalizeHandleClassName(className: string): string {
  return normalizeStyleHandleClassName(className);
}

export function createStyleHandle(className: string): StyleHandle {
  const handle: StyleHandle = {
    [STYLE_HANDLE_BRAND]: "dx-styles-style-handle",
  };
  const descriptor: StyleHandlePayload = Object.freeze({
    className: normalizeHandleClassName(className),
    kind: STYLE_HANDLE_DESCRIPTOR_KIND,
  });

  Object.defineProperty(handle, STYLE_HANDLE_BRAND, {
    configurable: false,
    enumerable: false,
    value: "dx-styles-style-handle",
    writable: false,
  });

  Object.defineProperty(handle, DX_STYLES_DESCRIPTOR_KEY, {
    configurable: false,
    enumerable: true,
    value: descriptor,
    writable: false,
  });

  runtimeStyleHandleRegistry.registerStyleHandleClassName(descriptor.className);

  return Object.freeze(handle);
}

export function attachRuntimeRecipeDefinition<TVariants extends VariantDefinitions>(
  recipe: (selection?: VariantSelection<TVariants>) => string,
  definition: RuntimeRecipeDefinition,
): Recipe<TVariants> {
  Object.defineProperty(recipe, RECIPE_DEFINITION_KEY, {
    configurable: false,
    enumerable: false,
    value: definition,
    writable: false,
  });

  return recipe as Recipe<TVariants>;
}

export function attachRuntimeSlotRecipeDefinition<
  TSlot extends string,
  TVariants extends SlotVariantDefinitions<TSlot>,
>(
  recipe: (selection?: SlotVariantSelection<TVariants>) => Record<TSlot, string>,
  definition: RuntimeSlotRecipeDefinition<TSlot>,
): SlotRecipe<TSlot, TVariants> {
  Object.defineProperty(recipe, SLOT_RECIPE_DEFINITION_KEY, {
    configurable: false,
    enumerable: false,
    value: definition,
    writable: false,
  });

  return recipe as SlotRecipe<TSlot, TVariants>;
}

function readRuntimeRecipeDefinition(
  recipe: RuntimeRecipeDefinitionCarrier,
  operation = "recipe style handles",
): RuntimeRecipeDefinition {
  const definition = recipe[RECIPE_DEFINITION_KEY];
  if (definition === undefined) {
    throw new Error(`dx-styles ${operation} requires a dx-styles recipe.`);
  }

  return definition;
}

function readRuntimeSlotRecipeDefinition<TSlot extends string>(
  recipe: RuntimeSlotRecipeDefinitionCarrier<TSlot>,
  operation = "slot recipe style handles",
): RuntimeSlotRecipeDefinition<TSlot> {
  const definition = recipe[SLOT_RECIPE_DEFINITION_KEY];
  if (definition === undefined) {
    throw new Error(`dx-styles ${operation} requires a dx-styles slotRecipe.`);
  }

  return definition;
}

function isObjectLike(value: unknown): value is object {
  return (typeof value === "object" && value !== null) || typeof value === "function";
}

function copyEnumerableOwnProperty(source: object, target: object, key: PropertyKey): void {
  const descriptor = Object.getOwnPropertyDescriptor(source, key);
  if (descriptor?.enumerable !== true) {
    return;
  }

  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    value: Reflect.get(source, key),
    writable: true,
  });
}

function splitPropsByVariantOrder<TVariantProps extends object, TProps extends object>(
  props: TProps,
  variantOrder: readonly string[],
  operation: string,
): SplitRecipePropsResult<TVariantProps, TProps> {
  if (!isObjectLike(props)) {
    throw new Error(`dx-styles ${operation} requires a props object.`);
  }

  const variantNames = new Set(variantOrder);
  const variantProps = {};
  const otherProps = {};

  Reflect.ownKeys(props).forEach((key) => {
    const target = typeof key === "string" && variantNames.has(key) ? variantProps : otherProps;
    copyEnumerableOwnProperty(props, target, key);
  });

  return {
    otherProps: otherProps as Omit<TProps, keyof TVariantProps>,
    variantProps: variantProps as TVariantProps,
  };
}

export function splitRecipeProps<TVariants extends VariantDefinitions, TProps extends object>(
  recipe: Recipe<TVariants>,
  props: TProps & VariantSelection<NoInfer<TVariants>>,
): SplitRecipePropsResult<VariantSelection<TVariants>, TProps> {
  const definition = readRuntimeRecipeDefinition(recipe, "splitRecipeProps()");
  return splitPropsByVariantOrder<VariantSelection<TVariants>, TProps>(
    props,
    definition.variantOrder,
    "splitRecipeProps()",
  );
}

export function splitSlotRecipeProps<
  TSlot extends string,
  TVariants extends SlotVariantDefinitions<TSlot>,
  TProps extends object,
>(
  recipe: SlotRecipe<TSlot, TVariants>,
  props: TProps & SlotVariantSelection<NoInfer<TVariants>>,
): SplitRecipePropsResult<SlotVariantSelection<TVariants>, TProps> {
  const definition = readRuntimeSlotRecipeDefinition(recipe, "splitSlotRecipeProps()");
  return splitPropsByVariantOrder<SlotVariantSelection<TVariants>, TProps>(
    props,
    definition.variantOrder,
    "splitSlotRecipeProps()",
  );
}

export function createRecipeStyleHandles<TVariants extends VariantDefinitions>(
  recipe: Recipe<TVariants>,
): RecipeStyleHandles {
  const definition = readRuntimeRecipeDefinition(recipe);
  if (definition.baseClassName === undefined || definition.baseClassName.length === 0) {
    throw new Error("dx-styles recipe style handles require a base style.");
  }

  return {
    root: createStyleHandle(definition.baseClassName),
    variants: Object.fromEntries(
      Object.entries(definition.variants).map(([axis, values]) => [
        axis,
        Object.fromEntries(
          Object.entries(values).map(([value, className]) => [value, createStyleHandle(className)]),
        ),
      ]),
    ),
  };
}

export function createSlotRecipeStyleHandles<
  TSlot extends string,
  TVariants extends SlotVariantDefinitions<TSlot>,
>(recipe: SlotRecipe<TSlot, TVariants>): SlotRecipeStyleHandles {
  const definition = readRuntimeSlotRecipeDefinition(recipe);
  const slots: Partial<Record<string, StyleHandle>> = {};
  const variants: Record<string, Record<string, Partial<Record<string, StyleHandle>>>> = {};

  definition.slots.forEach((slot) => {
    const className = definition.baseClassNames[slot];
    if (className.length > 0) {
      setRecordEntry(slots, slot, createStyleHandle(className));
    }
  });

  Object.entries(definition.variants).forEach(([axis, values]) => {
    const handlesByValue: Record<string, Partial<Record<string, StyleHandle>>> = {};

    Object.entries(values).forEach(([value, slotClassNames]) => {
      const classNamesBySlot: Record<string, string> = slotClassNames;
      const handlesBySlot: Partial<Record<string, StyleHandle>> = {};

      Object.entries(classNamesBySlot).forEach(([slot, className]) => {
        if (className.length > 0) {
          setRecordEntry(handlesBySlot, slot, createStyleHandle(className));
        }
      });

      setRecordEntry(handlesByValue, value, handlesBySlot);
    });

    setRecordEntry(variants, axis, handlesByValue);
  });

  return {
    slots,
    variants,
  };
}

// Mirrors the build-time/eval `buildTokenContract` in ../style-primitives.ts: leaf
// names are a pure function of (shape, prefix), so this runtime fallback and the
// `createTokenContract` WyW processor emit byte-identical variable names. (src/
// cannot import the package-root helper under tsconfig.lib's rootDir, hence the
// deliberate twin — same constraint that keeps `flattenContractAssignments` local.)
function buildContractLeafName(
  prefix: string,
  path: readonly string[],
  explicitName: null | string,
): string {
  const leafName = explicitName !== null && explicitName.length > 0 ? explicitName : path.join("-");
  return leafName.startsWith("--") ? leafName : `--${prefix}-${leafName}`;
}

function buildTokenContract(
  shape: Record<string, unknown>,
  prefix: string,
  path: readonly string[] = [],
): Record<string, unknown> {
  return recordEntries(shape).reduce<Record<string, unknown>>((acc, [key, value]) => {
    const nextPath = [...path, key];

    if (isPlainObject(value)) {
      setRecordEntry(acc, key, buildTokenContract(value, prefix, nextPath));
      return acc;
    }

    setRecordEntry(
      acc,
      key,
      `var(${buildContractLeafName(prefix, nextPath, typeof value === "string" ? value : null)})`,
    );

    return acc;
  }, {});
}

function readRawVariableName(contractValue: unknown): null | string {
  if (typeof contractValue !== "string") {
    return null;
  }

  const match = /^var\((--[^)]+)\)$/u.exec(contractValue);
  return match?.[1] ?? null;
}

function flattenContractAssignments(
  contract: unknown,
  values: unknown,
  allowPartial: boolean,
): Record<string, string | number> {
  if (!isPlainObject(contract)) {
    if (allowPartial) {
      return {};
    }

    throw new Error("dx-styles theme contract must be an object.");
  }

  if (!isPlainObject(values)) {
    if (allowPartial) {
      return {};
    }

    throw new Error("dx-styles theme values must be an object.");
  }

  return recordEntries(contract).reduce<Record<string, string | number>>(
    (acc, [key, contractValue]) => {
      const nextValue = values[key];

      if (isPlainObject(contractValue)) {
        if (nextValue === undefined || nextValue === null) {
          if (!allowPartial) {
            throw new Error(`Missing value for "${key}".`);
          }

          return acc;
        }

        if (!isPlainObject(nextValue)) {
          throw new Error(`Invalid variable value for "${key}".`);
        }

        Object.assign(acc, flattenContractAssignments(contractValue, nextValue, allowPartial));
        return acc;
      }

      if (nextValue === undefined || nextValue === null) {
        if (!allowPartial) {
          throw new Error(`Missing value for "${key}".`);
        }

        return acc;
      }

      const rawVariableName = readRawVariableName(contractValue);
      if (rawVariableName === null) {
        if (allowPartial) {
          return acc;
        }

        throw new Error(`Missing contract leaf for "${key}".`);
      }

      if (typeof nextValue !== "number" && typeof nextValue !== "string") {
        throw new Error(`Invalid variable value for "${key}".`);
      }

      acc[rawVariableName] = nextValue;
      return acc;
    },
    {},
  );
}

export function createThemeDescriptor<TShape extends ContractShape>(
  contract: TokenContract<TShape>,
  values: ContractValues<TShape>,
): PreevalThemeValue {
  const assignments = flattenContractAssignments(contract, values, false);
  const className = createRuntimeClassName("dxt", assignments);

  return {
    [DX_STYLES_DESCRIPTOR_KEY]: {
      assignments,
      className,
      kind: "theme",
    },
    [WYW_META_KEY]: {
      className,
      extends: null,
    },
  };
}

function isTokenContract<TShape extends ContractShape>(
  value: unknown,
  shape: TShape,
): value is TokenContract<TShape> {
  if (!isPlainObject(value)) {
    return false;
  }

  return recordEntries(shape).every(([key, shapeValue]) => {
    const nextValue = value[key];

    return isPlainObject(shapeValue)
      ? isTokenContract(nextValue, shapeValue)
      : typeof nextValue === "string";
  });
}

export function createTokenContract<TShape extends ContractShape>(
  shape: TShape,
  options: undefined | { readonly prefix: string },
): TokenContract<TShape> {
  const prefix = typeof options?.prefix === "string" ? options.prefix.trim() : "";
  if (prefix.length === 0) {
    throw new Error("dx-styles createTokenContract() requires a non-empty prefix.");
  }

  const contract = buildTokenContract(shape, prefix);
  if (!isTokenContract(contract, shape)) {
    throw new Error("Failed to build token contract.");
  }

  return contract;
}

export function assignVars<TShape extends ContractShape>(
  contract: TokenContract<TShape>,
  values: PartialContractValues<TShape>,
): Record<string, string | number> {
  return flattenContractAssignments(contract, values, true);
}

/**
 * Value-form handle for a private (build-time hashed) CSS custom property: the
 * string `var(--name)`. Usable directly as a style value; unwrap with `varName`
 * (or `setVar`) when declaring its value.
 */
export type CssVar = string & { readonly __dxCssVar?: never };

const VAR_REFERENCE = /^var\((--[^),]+)\)$/u;

let runtimeVarCounter = 0;

/**
 * Declares a private CSS custom property. This is a dx-styles WyW tag: at build
 * time the call is replaced with a slug-scoped hashed name. The runtime body here
 * is only a fallback for non-extracted paths (e.g. SSR/tests without the plugin).
 */
export function createVar(): CssVar {
  runtimeVarCounter += 1;
  return `var(--dx-r${runtimeVarCounter.toString(36)})` as CssVar;
}

/** Extracts the bare `--name` from a `var(--name)` handle (for declarations). */
export function varName(handle: CssVar): string {
  const match = VAR_REFERENCE.exec(handle);
  if (match === null) {
    throw new Error(`dx-styles varName() expects a createVar() handle, received "${handle}".`);
  }

  return match[1];
}

/** Declares a value for a private var handle: `css(setVar(bg, "red"))`. */
export function setVar(handle: CssVar, value: number | string): Record<string, number | string> {
  return { [varName(handle)]: value };
}

export function css(...parts: StylePart[]): CssClassName {
  const descriptor = createCssDescriptor(...parts);
  const styleHandleClassNames = descriptor[DX_STYLES_DESCRIPTOR_KEY].classNameRefs;
  const ownStyleClassName =
    Object.keys(descriptor[DX_STYLES_DESCRIPTOR_KEY].style).length > 0 ||
    styleHandleClassNames.length === 0
      ? getDescriptorClassName(descriptor)
      : undefined;

  return toCssClassName(cx(...styleHandleClassNames, ownStyleClassName));
}

export type StylePartClassNameFactory = (part: StylePart) => string;

function toOptionalClassNameWithFactory(
  part: false | null | StylePart | undefined,
  classNameFactory: StylePartClassNameFactory,
): string | undefined {
  return part === undefined || part === null || part === false ? undefined : classNameFactory(part);
}

function expectSlotStylePart(value: unknown): StylePart | undefined {
  if (value === undefined || value === null || value === false) {
    return value;
  }

  if (typeof value === "string") {
    return toCssClassName(value);
  }

  if (isCssDescriptor(value) || isStyleObject(value)) {
    return value;
  }

  throw new Error(
    "dx-styles css() supports only style objects and previously declared css() results.",
  );
}

function expectSlotStyleMap(
  styles: unknown,
  slots: readonly string[],
  context: string,
): Partial<Record<string, StylePart>> {
  if (styles === undefined) {
    return {};
  }

  if (!isPlainObject(styles)) {
    throw new Error(`dx-styles slotRecipe() ${context} must be a slot style object.`);
  }

  const knownSlots = new Set(slots);

  return Object.entries(styles).reduce<Partial<Record<string, StylePart>>>((acc, [slot, style]) => {
    if (!knownSlots.has(slot)) {
      throw new Error(`dx-styles slotRecipe() ${context} references unknown slot "${slot}".`);
    }

    setRecordEntry(acc, slot, expectSlotStylePart(style));
    return acc;
  }, {});
}

function hasAllSlots<TSlot extends string>(
  slots: readonly TSlot[],
  value: Partial<Record<TSlot, string>>,
): value is Record<TSlot, string> {
  return slots.every((slot) => typeof value[slot] === "string");
}

function createSlotClassRecord<TSlot extends string>(
  slots: readonly TSlot[],
  styles: unknown,
  context: string,
  classNameFactory: StylePartClassNameFactory,
): Record<TSlot, string> {
  const slotStyles = expectSlotStyleMap(styles, slots, context);
  const result: Partial<Record<TSlot, string>> = {};

  slots.forEach((slot) => {
    const slotStyle = slotStyles[slot];
    setRecordEntry(result, slot, toOptionalClassNameWithFactory(slotStyle, classNameFactory) ?? "");
  });

  if (!hasAllSlots(slots, result)) {
    throw new Error("Failed to build slot class record.");
  }

  return result;
}

function normalizeDefaultVariants(
  defaultVariants?: Record<string, string | undefined>,
): Record<string, string> {
  if (defaultVariants === undefined) {
    return {};
  }

  return recordEntries(defaultVariants).reduce<Record<string, string>>((acc, [key, value]) => {
    if (typeof value === "string") {
      setRecordEntry(acc, key, value);
    }

    return acc;
  }, {});
}

function expectCompoundVariantEntry<TCss>(
  entry: LooseCompoundVariant<TCss>,
  componentName: "recipe" | "slotRecipe",
  index: number,
  allowedAxes: ReadonlySet<string>,
): {
  readonly css: TCss;
  readonly matches: Record<string, string>;
} {
  if (!Object.hasOwn(entry, "css") || entry.css === undefined) {
    throw new Error(`dx-styles ${componentName}() compound variant #${index} requires a css field.`);
  }

  const matches = Object.entries(entry).reduce<Record<string, string>>((acc, [key, value]) => {
    if (key === "css") {
      return acc;
    }

    if (!allowedAxes.has(key)) {
      throw new Error(
        `dx-styles ${componentName}() compound variant #${index} references unknown variant axis "${key}".`,
      );
    }

    if (typeof value !== "string") {
      throw new Error(
        `dx-styles ${componentName}() compound variant #${index} requires string match values.`,
      );
    }

    setRecordEntry(acc, key, value);
    return acc;
  }, {});

  return {
    css: entry.css,
    matches,
  };
}

export function compileRecipeDefinition<TVariants extends VariantDefinitions>(
  config: RecipeConfig<TVariants>,
  classNameFactory: StylePartClassNameFactory,
): RuntimeRecipeDefinition {
  const variants: VariantDefinitions = config.variants === undefined ? {} : { ...config.variants };
  const variantOrder = Object.keys(variants);

  return {
    baseClassName: toOptionalClassNameWithFactory(config.base, classNameFactory),
    compoundVariants: (config.compoundVariants ?? []).map((entry, index) => {
      const { css: style, matches } = expectCompoundVariantEntry(
        entry,
        "recipe",
        index,
        new Set(variantOrder),
      );

      return {
        className: classNameFactory(style),
        matches,
      };
    }),
    defaultVariants:
      config.defaultVariants === undefined
        ? {}
        : normalizeDefaultVariants({ ...config.defaultVariants }),
    variantOrder,
    variants: variantOrder.reduce<Record<string, Record<string, string>>>((acc, axis) => {
      const axisValues = variants[axis];
      const nextAxisValues = recordEntries(axisValues).reduce<Record<string, string>>(
        (axisAcc, [value, style]) => {
          setRecordEntry(axisAcc, value, classNameFactory(style));
          return axisAcc;
        },
        {},
      );

      setRecordEntry(acc, axis, nextAxisValues);
      return acc;
    }, {}),
  };
}

export function compileRuntimeRecipeDefinition<TVariants extends VariantDefinitions>(
  config: RecipeConfig<TVariants>,
): RuntimeRecipeDefinition {
  return compileRecipeDefinition(config, css);
}

export function compileSlotRecipeDefinition<
  TSlot extends string,
  TVariants extends SlotVariantDefinitions<TSlot>,
>(
  config: SlotRecipeConfig<TSlot, TVariants>,
  classNameFactory: StylePartClassNameFactory,
): RuntimeSlotRecipeDefinition<TSlot> {
  const variants: SlotVariantDefinitions<TSlot> =
    config.variants === undefined ? {} : { ...config.variants };
  const variantOrder = Object.keys(variants);

  return {
    baseClassNames: createSlotClassRecord(config.slots, config.base, "base", classNameFactory),
    compoundVariants: (config.compoundVariants ?? []).map((entry, index) => {
      const { css: styles, matches } = expectCompoundVariantEntry(
        entry,
        "slotRecipe",
        index,
        new Set(variantOrder),
      );

      return {
        classNames: createSlotClassRecord(
          config.slots,
          styles,
          `compound variant #${index} css`,
          classNameFactory,
        ),
        matches,
      };
    }),
    defaultVariants:
      config.defaultVariants === undefined
        ? {}
        : normalizeDefaultVariants({ ...config.defaultVariants }),
    slots: config.slots,
    variantOrder,
    variants: variantOrder.reduce<Record<string, Record<string, Record<TSlot, string>>>>(
      (acc, axis) => {
        const axisValues = variants[axis];
        const nextAxisValues = recordEntries(axisValues).reduce<
          Record<string, Record<TSlot, string>>
        >((axisAcc, [value, styles]) => {
          setRecordEntry(
            axisAcc,
            value,
            createSlotClassRecord(
              config.slots,
              styles,
              `variant "${axis}.${value}"`,
              classNameFactory,
            ),
          );
          return axisAcc;
        }, {});

        setRecordEntry(acc, axis, nextAxisValues);
        return acc;
      },
      {},
    ),
  };
}

export function compileRuntimeSlotRecipeDefinition<
  TSlot extends string,
  TVariants extends SlotVariantDefinitions<TSlot>,
>(config: SlotRecipeConfig<TSlot, TVariants>): RuntimeSlotRecipeDefinition<TSlot> {
  return compileSlotRecipeDefinition(config, css);
}
