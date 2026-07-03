import {
  BaseProcessor,
  type CallParam,
  type ObjectWithSelectors,
  type ProcessorParams,
  type ValueCache,
} from "@wyw-in-js/processor-utils";
import { type ExpressionValue, type ICSSRule, ValueType } from "@wyw-in-js/shared";

import {
  cloneStyleObject,
  createStyleHandleRegistry,
  DX_STYLES_DESCRIPTOR_KEY,
  hasCssDescriptorMarker,
  hashString,
  isPlainObject,
  isStyleLeafArray,
  isStyleObject,
  isStylePrimitive,
  readCssDescriptorStyle,
  readStyleHandleClassName,
  stableStringify,
  type STYLE_HANDLE_DESCRIPTOR_KIND,
  type StyleEntry,
  type StyleObject,
  type StylePrimitive,
} from "../style-primitives.js";
import {
  type DxStylesExplainArtifactName,
  type DxStylesExplainEntry,
  type DxStylesExplainPayload,
} from "./explain-schema.js";
import { toCSS } from "./serialization.js";

export {
  buildTokenContract,
  createRuntimeClassName,
  flattenContractAssignments,
  isPlainObject,
  mergeStyleObjects,
  stableStringify,
} from "../style-primitives.js";

export type { StyleObject };
export type { TokenContractObject } from "../style-primitives.js";

type SourceLocation = {
  readonly start?: ICSSRule["start"];
} | null;

export const DX_STYLES_EXPLAIN_ARTIFACT: DxStylesExplainArtifactName = "dx-styles:explain";
const RTL_MARKER = "$rtl";
const NOFLIP_MARKER = "$noflip";
const RTL_SELECTOR = ":dir(rtl) &";
const extractedStyleHandleRegistry = createStyleHandleRegistry();

function setRecordEntry(record: object, key: string, value: unknown): void {
  Object.defineProperty(record, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

interface CssDescriptorValue {
  readonly [DX_STYLES_DESCRIPTOR_KEY]: {
    readonly className: string;
    readonly classNameRefs?: readonly string[];
    readonly kind: "css";
    readonly style: StyleObject;
  };
}

interface StyleHandleValue {
  readonly [DX_STYLES_DESCRIPTOR_KEY]: {
    readonly className: string;
    readonly kind: typeof STYLE_HANDLE_DESCRIPTOR_KIND;
  };
}

interface ThemeDescriptorValue {
  readonly [DX_STYLES_DESCRIPTOR_KEY]: {
    readonly kind: "theme";
  };
}

interface LooseCompoundVariant {
  readonly css?: unknown;
  readonly [key: string]: unknown;
}

interface LooseRecipeConfig {
  readonly base?: unknown;
  readonly compoundVariants?: readonly LooseCompoundVariant[];
  readonly defaultVariants?: Readonly<Record<string, string>>;
  readonly variants?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}

interface LooseSlotRecipeConfig {
  readonly slots: readonly string[];
  readonly base?: Readonly<Record<string, unknown>>;
  readonly compoundVariants?: readonly LooseCompoundVariant[];
  readonly defaultVariants?: Readonly<Record<string, string>>;
  readonly variants?: Readonly<
    Record<string, Readonly<Record<string, Readonly<Record<string, unknown>>>>>
  >;
}

interface RuntimeRecipeCompoundVariant {
  readonly className: string;
  readonly matches: Record<string, string>;
}

interface RuntimeRecipeDefinition {
  readonly baseClassName?: string;
  readonly compoundVariants: readonly RuntimeRecipeCompoundVariant[];
  readonly defaultVariants: Record<string, string>;
  readonly variantOrder: readonly string[];
  readonly variants: Record<string, Record<string, string>>;
}

interface RuntimeSlotRecipeCompoundVariant {
  readonly classNames: Record<string, string>;
  readonly matches: Record<string, string>;
}

interface RuntimeSlotRecipeDefinition {
  readonly baseClassNames: Record<string, string>;
  readonly compoundVariants: readonly RuntimeSlotRecipeCompoundVariant[];
  readonly defaultVariants: Record<string, string>;
  readonly slots: readonly string[];
  readonly variantOrder: readonly string[];
  readonly variants: Record<string, Record<string, Record<string, string>>>;
}

export type DxStylesExplainArtifact = [
  name: typeof DX_STYLES_EXPLAIN_ARTIFACT,
  data: DxStylesExplainPayload,
];

export type { DxStylesExplainEntry } from "./explain-schema.js";

export function isCssDescriptor(value: unknown): value is CssDescriptorValue {
  return readCssDescriptorStyle(value) !== null && readCssDescriptorClassName(value) !== null;
}

function isStyleHandle(value: unknown): value is StyleHandleValue {
  return readStyleHandleClassName(value) !== null;
}

function readCssDescriptorClassName(value: unknown): null | string {
  if (!isPlainObject(value)) {
    return null;
  }

  const descriptor = value[DX_STYLES_DESCRIPTOR_KEY];
  if (
    !isPlainObject(descriptor) ||
    descriptor.kind !== "css" ||
    typeof descriptor.className !== "string"
  ) {
    return null;
  }

  return descriptor.className;
}

export function isThemeDescriptor(value: unknown): value is ThemeDescriptorValue {
  if (!isPlainObject(value)) {
    return false;
  }

  const descriptor = value[DX_STYLES_DESCRIPTOR_KEY];
  return isPlainObject(descriptor) && descriptor.kind === "theme";
}

export function registerExtractedStyle(className: string, style: StyleObject): void {
  extractedStyleHandleRegistry.registerStyle(className, cloneStyleObject(style));
}

export function normalizeStyleParts(parts: readonly unknown[]): StyleObject {
  return extractedStyleHandleRegistry.normalizeStyleParts(parts);
}

function hasDefinedStylePart(part: unknown): boolean {
  return part !== undefined && part !== null && part !== false;
}

const logicalPropertySuggestions = new Map<string, string>([
  ["left", "insetInlineStart"],
  ["right", "insetInlineEnd"],
  ["marginLeft", "marginInlineStart"],
  ["marginRight", "marginInlineEnd"],
  ["paddingLeft", "paddingInlineStart"],
  ["paddingRight", "paddingInlineEnd"],
  ["borderLeft", "borderInlineStart"],
  ["borderRight", "borderInlineEnd"],
  ["borderLeftColor", "borderInlineStartColor"],
  ["borderRightColor", "borderInlineEndColor"],
  ["borderLeftStyle", "borderInlineStartStyle"],
  ["borderRightStyle", "borderInlineEndStyle"],
  ["borderLeftWidth", "borderInlineStartWidth"],
  ["borderRightWidth", "borderInlineEndWidth"],
]);

const logicalValueSuggestions = new Map<string, ReadonlyMap<string, string>>([
  [
    "float",
    new Map([
      ["left", "inline-start"],
      ["right", "inline-end"],
    ]),
  ],
  [
    "textAlign",
    new Map([
      ["left", "start"],
      ["right", "end"],
    ]),
  ],
]);

interface RtlTransformState {
  readonly disabled: boolean;
  readonly enabled: boolean;
}

interface RtlPropertyPair {
  readonly left: string;
  readonly resetValue: StylePrimitive;
  readonly right: string;
}

const rtlPropertyPairs: readonly RtlPropertyPair[] = [
  { left: "left", resetValue: "auto", right: "right" },
  { left: "marginLeft", resetValue: 0, right: "marginRight" },
  { left: "paddingLeft", resetValue: 0, right: "paddingRight" },
];

const rtlHandledProperties = new Set(rtlPropertyPairs.flatMap(({ left, right }) => [left, right]));

const rtlValueTransforms = new Map<string, ReadonlyMap<string, string>>([
  [
    "textAlign",
    new Map([
      ["left", "right"],
      ["right", "left"],
    ]),
  ],
]);

function isRtlMarkerKey(key: string): boolean {
  return key === RTL_MARKER || key === NOFLIP_MARKER;
}

function createRtlTransformState(
  style: StyleObject,
  inheritedState: RtlTransformState,
): RtlTransformState {
  const disabled = inheritedState.disabled || style[NOFLIP_MARKER] === true;

  return {
    disabled,
    enabled: !disabled && (inheritedState.enabled || style[RTL_MARKER] === true),
  };
}

function createDiagnosticContext(context: string, path: readonly string[]): string {
  const pathText = path.length === 0 ? "" : ` at ${path.join(".")}`;

  return `${context}${pathText}`;
}

function reportPhysicalPropertyDiagnostic(
  processor: Pick<BaseProcessor, "addDiagnostic">,
  property: string,
  suggestion: string,
  context: string,
): void {
  processor.addDiagnostic({
    category: "dx-styles/physical-direction-property",
    message: `Use logical CSS property "${suggestion}" instead of "${property}" in ${context} so the style follows document direction.`,
    severity: "warning",
  });
}

function reportPhysicalValueDiagnostic(
  processor: Pick<BaseProcessor, "addDiagnostic">,
  property: string,
  value: string,
  suggestion: string,
  context: string,
): void {
  processor.addDiagnostic({
    category: "dx-styles/physical-direction-value",
    message: `Use ${property}: "${suggestion}" instead of "${value}" in ${context} so the style follows document direction.`,
    severity: "warning",
  });
}

function isHandledByRtlTransform(
  key: string,
  value: StyleEntry,
  state: RtlTransformState,
): boolean {
  if (!state.enabled || state.disabled) {
    return false;
  }

  if (isStylePrimitive(value) && rtlHandledProperties.has(key)) {
    return true;
  }

  if (typeof value !== "string") {
    return false;
  }

  return rtlValueTransforms.get(key)?.has(value) ?? false;
}

function reportStyleObjectDiagnostics(
  processor: Pick<BaseProcessor, "addDiagnostic">,
  style: StyleObject,
  context: string,
  path: readonly string[],
  inheritedState: RtlTransformState,
): void {
  const state = createRtlTransformState(style, inheritedState);

  if (state.disabled) {
    return;
  }

  for (const [key, value] of Object.entries(style)) {
    if (isRtlMarkerKey(key)) {
      continue;
    }

    if (value === undefined || value === null || value === false) {
      continue;
    }

    const diagnosticContext = createDiagnosticContext(context, [...path, key]);
    const propertySuggestion = logicalPropertySuggestions.get(key);

    if (propertySuggestion !== undefined && !isHandledByRtlTransform(key, value, state)) {
      reportPhysicalPropertyDiagnostic(processor, key, propertySuggestion, diagnosticContext);
    }

    const valueSuggestions = logicalValueSuggestions.get(key);
    const values = isStyleLeafArray(value) ? value : [value];

    if (valueSuggestions !== undefined) {
      values.forEach((entry) => {
        if (typeof entry === "string") {
          const valueSuggestion = valueSuggestions.get(entry);

          if (valueSuggestion !== undefined && !isHandledByRtlTransform(key, entry, state)) {
            reportPhysicalValueDiagnostic(
              processor,
              key,
              entry,
              valueSuggestion,
              diagnosticContext,
            );
          }
        }
      });
    }

    if (isStyleObject(value) && !hasCssDescriptorMarker(value) && !isStyleHandle(value)) {
      reportStyleObjectDiagnostics(processor, value, context, [...path, key], state);
    }
  }
}

export function reportStylePartDiagnostics(
  processor: Pick<BaseProcessor, "addDiagnostic">,
  part: unknown,
  context: string,
): void {
  if (
    !hasDefinedStylePart(part) ||
    hasCssDescriptorMarker(part) ||
    isStyleHandle(part) ||
    !isStyleObject(part)
  ) {
    return;
  }

  reportStyleObjectDiagnostics(processor, part, context, [], { disabled: false, enabled: false });
}

export function expectSlotStyleMap(
  styles: unknown,
  slots: readonly string[],
  context: string,
): Record<string, unknown> {
  if (!isPlainObject(styles)) {
    throw new Error(`dx-styles slotRecipe() ${context} must be a slot style object.`);
  }

  const knownSlots = new Set(slots);

  Object.entries(styles).forEach(([slot, style]) => {
    if (!knownSlots.has(slot)) {
      throw new Error(`dx-styles slotRecipe() ${context} references unknown slot "${slot}".`);
    }

    if (hasDefinedStylePart(style)) {
      normalizeStyleParts([style]);
    }
  });

  return styles;
}

function hasEntries(value: Readonly<Record<string, unknown>>): boolean {
  return Object.keys(value).length > 0;
}

export function hasStyleEntries(style: StyleObject): boolean {
  return hasEntries(style);
}

function createRtlOverride(style: StyleObject): StyleObject {
  const override: Record<string, StyleEntry> = {};

  rtlPropertyPairs.forEach(({ left, resetValue, right }) => {
    const leftValue = style[left];
    const rightValue = style[right];
    const hasLeftValue = isStylePrimitive(leftValue);
    const hasRightValue = isStylePrimitive(rightValue);

    if (hasLeftValue && hasRightValue) {
      override[left] = rightValue;
      override[right] = leftValue;
      return;
    }

    if (hasLeftValue) {
      override[left] = resetValue;
      override[right] = leftValue;
      return;
    }

    if (hasRightValue) {
      override[left] = rightValue;
      override[right] = resetValue;
    }
  });

  const textAlignValue = style.textAlign;
  if (typeof textAlignValue === "string") {
    const flippedTextAlign = rtlValueTransforms.get("textAlign")?.get(textAlignValue);

    if (flippedTextAlign !== undefined) {
      override.textAlign = flippedTextAlign;
    }
  }

  return override;
}

function mergeRtlOverride(existing: unknown, override: StyleObject): ObjectWithSelectors {
  if (existing === undefined) {
    return transformStyleObject(override, { disabled: false, enabled: false });
  }

  if (!isStyleObject(existing)) {
    throw new Error(`dx-styles ${RTL_SELECTOR} selector must be a style object.`);
  }

  return {
    ...transformStyleObject(override, { disabled: false, enabled: false }),
    ...transformStyleObject(existing, { disabled: true, enabled: false }),
  };
}

function transformStyleObject(
  style: StyleObject,
  inheritedState: RtlTransformState,
): ObjectWithSelectors {
  const state = createRtlTransformState(style, inheritedState);
  const result = Object.entries(style).reduce<ObjectWithSelectors>((acc, [key, value]) => {
    if (isRtlMarkerKey(key)) {
      return acc;
    }

    if (value === undefined || value === null || value === false) {
      return acc;
    }

    if (value === true) {
      throw new Error(
        `dx-styles style property "${key}" cannot be true; only ${RTL_MARKER} and ${NOFLIP_MARKER} use boolean markers.`,
      );
    }

    if (isStyleHandle(value)) {
      throw new Error(
        `dx-styles style property "${key}" cannot reference a style handle; compose handles with css(handle, { ... }) instead.`,
      );
    }

    if (Array.isArray(value) && !isStyleLeafArray(value)) {
      throw new Error(`dx-styles style property "${key}" cannot use non-primitive array values.`);
    }

    if (isStyleObject(value)) {
      setRecordEntry(
        acc,
        key,
        transformStyleObject(
          value,
          key === RTL_SELECTOR ? { disabled: true, enabled: false } : state,
        ),
      );
      return acc;
    }

    if (isStyleLeafArray(value)) {
      setRecordEntry(acc, key, [...value]);
      return acc;
    }

    if (!isStylePrimitive(value)) {
      throw new Error(
        `dx-styles style property "${key}" must be a primitive, primitive array, or nested style object.`,
      );
    }

    setRecordEntry(acc, key, value);
    return acc;
  }, {});

  if (state.enabled && !state.disabled) {
    const override = createRtlOverride(style);

    if (hasEntries(override)) {
      setRecordEntry(result, RTL_SELECTOR, mergeRtlOverride(result[RTL_SELECTOR], override));
    }
  }

  return result;
}

export function toCSSStyle(style: StyleObject): string {
  return toCSS(transformStyleObject(style, { disabled: false, enabled: false }));
}

export function collectComposeRefs(parts: readonly unknown[]): string[] {
  const seen = new Set<string>();

  const addClassName = (className: string) => {
    if (className.length > 0) {
      seen.add(className);
    }
  };

  parts.forEach((part) => {
    if (typeof part === "string") {
      part
        .split(/\s+/u)
        .filter((token) => token.length > 0)
        .forEach(addClassName);
      return;
    }

    const className = readCssDescriptorClassName(part);
    if (className !== null) {
      addClassName(className);
      return;
    }

    const styleHandleClassName = readStyleHandleClassName(part);
    if (styleHandleClassName !== null) {
      styleHandleClassName
        .split(/\s+/u)
        .filter((token) => token.length > 0)
        .forEach(addClassName);
    }
  });

  return [...seen];
}

export function collectStyleHandleClassNames(parts: readonly unknown[]): string[] {
  return extractedStyleHandleRegistry.collectStyleHandleClassNames(parts);
}

export function composeClassNames(
  ...classNames: readonly (false | null | string | undefined)[]
): string {
  const tokens = classNames.flatMap((token) => {
    return typeof token === "string"
      ? token.split(/\s+/u).filter((className) => className.length > 0)
      : [];
  });

  return Array.from(new Set(tokens)).join(" ");
}

export function shouldEmitLocalStyleRule(
  style: StyleObject,
  styleHandleClassNames: readonly string[],
): boolean {
  return hasStyleEntries(style) || styleHandleClassNames.length === 0;
}

export function createStylePartRuntimeClassName(
  localClassName: string,
  parts: readonly unknown[],
): string {
  const styleHandleClassNames = collectStyleHandleClassNames(parts);
  const style = normalizeStyleParts(parts);

  return composeClassNames(
    ...styleHandleClassNames,
    shouldEmitLocalStyleRule(style, styleHandleClassNames) ? localClassName : undefined,
  );
}

export function createExplainArtifact(
  entries: readonly DxStylesExplainEntry[],
): DxStylesExplainArtifact {
  return [
    DX_STYLES_EXPLAIN_ARTIFACT,
    {
      entries,
      version: 1,
    },
  ];
}

export function collectStringMatches(
  value: Readonly<Record<string, unknown>>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value).filter(([key, entry]) => key !== "css" && typeof entry === "string"),
  ) as Record<string, string>;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isPlainObject(value) && Object.values(value).every((entry) => typeof entry === "string");
}

function isLooseCompoundVariantEntry(value: unknown): value is LooseCompoundVariant {
  return isPlainObject(value);
}

function isLooseCompoundVariant(value: unknown): value is LooseCompoundVariant {
  if (!isPlainObject(value) || !Object.hasOwn(value, "css") || value.css === undefined) {
    return false;
  }

  return Object.entries(value).every(([key, entry]) => {
    return key === "css" || typeof entry === "string";
  });
}

function isLooseRecipeConfig(value: unknown): value is LooseRecipeConfig {
  if (!isPlainObject(value)) {
    return false;
  }

  if (value.defaultVariants !== undefined && !isStringRecord(value.defaultVariants)) {
    return false;
  }

  if (
    value.compoundVariants !== undefined &&
    (!Array.isArray(value.compoundVariants) ||
      !value.compoundVariants.every(isLooseCompoundVariantEntry))
  ) {
    return false;
  }

  if (
    value.variants !== undefined &&
    (!isPlainObject(value.variants) || !Object.values(value.variants).every(isPlainObject))
  ) {
    return false;
  }

  return true;
}

function isSlotVariantAxis(
  value: unknown,
): value is Readonly<Record<string, Readonly<Record<string, unknown>>>> {
  return isPlainObject(value) && Object.values(value).every(isPlainObject);
}

function isLooseSlotRecipeConfig(value: unknown): value is LooseSlotRecipeConfig {
  if (!isPlainObject(value)) {
    return false;
  }

  if (!Array.isArray(value.slots) || !value.slots.every((slot) => typeof slot === "string")) {
    return false;
  }

  if (value.base !== undefined && !isPlainObject(value.base)) {
    return false;
  }

  if (value.defaultVariants !== undefined && !isStringRecord(value.defaultVariants)) {
    return false;
  }

  if (
    value.compoundVariants !== undefined &&
    (!Array.isArray(value.compoundVariants) ||
      !value.compoundVariants.every(isLooseCompoundVariantEntry))
  ) {
    return false;
  }

  if (
    value.variants !== undefined &&
    (!isPlainObject(value.variants) || !Object.values(value.variants).every(isSlotVariantAxis))
  ) {
    return false;
  }

  return true;
}

export function resolveExpressionValue(expression: ExpressionValue, values: ValueCache): unknown {
  if ("value" in expression) {
    return expression.value;
  }

  return values.get(expression.ex.name);
}

export function createPreevalArgumentNode(
  astService: BaseProcessor["astService"],
  expression: ExpressionValue,
): ReturnType<BaseProcessor["astService"]["callExpression"]> | ExpressionValue["ex"] {
  if (expression.kind === ValueType.CONST) {
    return expression.ex;
  }

  return astService.callExpression(expression.ex, []);
}

export function createPreevalCallNode(
  astService: BaseProcessor["astService"],
  callee: ReturnType<BaseProcessor["astService"]["identifier"]>,
  expressions: readonly ExpressionValue[],
): ReturnType<BaseProcessor["astService"]["callExpression"]> {
  return astService.callExpression(
    callee,
    expressions.map((expression) => createPreevalArgumentNode(astService, expression)),
  );
}

export function createImportedPreevalCallNode(
  astService: BaseProcessor["astService"],
  importName: string,
  expressions: readonly ExpressionValue[],
): ReturnType<BaseProcessor["astService"]["callExpression"]> {
  return createPreevalCallNode(
    astService,
    astService.addNamedImport(importName, "dx-styles/preeval-runtime", importName),
    expressions,
  );
}

export function collectDependencies(
  target: { readonly dependencies: ExpressionValue[] },
  expressions: readonly ExpressionValue[],
): void {
  expressions.forEach((expression) => {
    if (expression.kind !== ValueType.CONST) {
      target.dependencies.push(expression);
    }
  });
}

export function getCallExpressions(params: ProcessorParams[0]): ExpressionValue[] {
  const callParam = params.find((param): param is CallParam => param[0] === "call");
  if (!callParam) {
    throw new Error("dx-styles processors require call expressions.");
  }

  const [, ...expressions] = callParam;
  return expressions;
}

export function ruleForSelector(
  className: string,
  displayName: string,
  cssText: string,
  location: SourceLocation | null,
): Record<string, ICSSRule> {
  return {
    [`.${className}`]: {
      className,
      cssText,
      displayName,
      start: location?.start,
    },
  };
}

function expectCompoundVariantEntry(
  entry: LooseCompoundVariant,
  componentName: "recipe" | "slotRecipe",
  index: number,
  allowedAxes: ReadonlySet<string>,
): {
  readonly css: unknown;
  readonly matches: Record<string, string>;
} {
  if (!isLooseCompoundVariant(entry)) {
    throw new Error(
      `dx-styles ${componentName}() compound variant #${index} must include css and string match values.`,
    );
  }

  const matches = Object.entries(entry).reduce<Record<string, string>>((acc, [key, value]) => {
    if (key !== "css") {
      if (!allowedAxes.has(key)) {
        throw new Error(
          `dx-styles ${componentName}() compound variant #${index} references unknown variant axis "${key}".`,
        );
      }

      setRecordEntry(acc, key, String(value));
    }

    return acc;
  }, {});

  return {
    css: entry.css,
    matches,
  };
}

export function expectRecipeConfig(value: unknown): LooseRecipeConfig {
  if (!isLooseRecipeConfig(value)) {
    throw new Error("dx-styles recipe() requires a statically analyzable recipe config object.");
  }

  if (hasDefinedStylePart(value.base)) {
    normalizeStyleParts([value.base]);
  }

  const allowedAxes = new Set(Object.keys(value.variants ?? {}));
  (value.compoundVariants ?? []).forEach((entry, index) => {
    expectCompoundVariantEntry(entry, "recipe", index, allowedAxes);
  });

  return value;
}

export function expectSlotRecipeConfig(value: unknown): LooseSlotRecipeConfig {
  if (!isLooseSlotRecipeConfig(value)) {
    throw new Error(
      "dx-styles slotRecipe() requires a statically analyzable slot recipe config object.",
    );
  }

  if (value.base !== undefined) {
    expectSlotStyleMap(value.base, value.slots, "base");
  }

  Object.entries(value.variants ?? {}).forEach(([axis, values]) => {
    Object.entries(values).forEach(([variantValue, styles]) => {
      expectSlotStyleMap(styles, value.slots, `variant "${axis}.${variantValue}"`);
    });
  });

  const allowedAxes = new Set(Object.keys(value.variants ?? {}));
  (value.compoundVariants ?? []).forEach((entry, index) => {
    const { css } = expectCompoundVariantEntry(entry, "slotRecipe", index, allowedAxes);
    expectSlotStyleMap(css, value.slots, `compound variant #${index} css`);
  });

  return value;
}

function encodeClassNameSegment(value: number | string): string {
  const buffer = Buffer.from(String(value), "utf8");
  return `${buffer.length.toString(36)}_${buffer.toString("hex")}`;
}

// In dev each segment is length-prefixed hex (verbose but human-decodable). In
// prod the whole segment tuple collapses into one short deterministic hash; the
// readable structure stays available through the explain manifest, not the name.
// `stableStringify` is used (not a delimiter join) so the serialization stays
// unambiguous when axis/value/slot names contain arbitrary characters — a join
// would let e.g. {"a":{"b c":…}} and {"a b":{"c":…}} hash to the same name.
function createScopedClassName(
  className: string,
  minify: boolean,
  ...parts: readonly (number | string)[]
): string {
  if (minify) {
    return `${className}_${hashString(stableStringify(parts))}`;
  }

  return [className, ...parts.map(encodeClassNameSegment)].join("__");
}

export function shouldMinifyClassNames(options: unknown): boolean {
  if (!isPlainObject(options) || !isPlainObject(options.processors)) {
    return false;
  }

  const { dxStyles } = options.processors;
  return isPlainObject(dxStyles) && dxStyles.minifyClassNames === true;
}

export function createRecipeRuntimeDefinition(
  className: string,
  config: LooseRecipeConfig,
  minify: boolean,
): RuntimeRecipeDefinition {
  const variants = config.variants ?? {};
  const variantOrder = Object.keys(variants);

  return {
    baseClassName: hasDefinedStylePart(config.base) ? `${className}__base` : undefined,
    compoundVariants: (config.compoundVariants ?? []).map((entry, index) => {
      const { matches } = expectCompoundVariantEntry(entry, "recipe", index, new Set(variantOrder));

      return {
        className: createScopedClassName(className, minify, "compound", index),
        matches,
      };
    }),
    defaultVariants: { ...(config.defaultVariants ?? {}) },
    variantOrder,
    variants: Object.fromEntries(
      variantOrder.map((axis) => [
        axis,
        Object.fromEntries(
          Object.keys(variants[axis] ?? {}).map((value) => [
            value,
            createScopedClassName(className, minify, "variant", axis, value),
          ]),
        ),
      ]),
    ),
  };
}

export function createSlotRecipeRuntimeDefinition(
  className: string,
  config: LooseSlotRecipeConfig,
  minify: boolean,
): RuntimeSlotRecipeDefinition {
  const variants = config.variants ?? {};
  const variantOrder = Object.keys(variants);
  const baseStyles =
    config.base === undefined ? {} : expectSlotStyleMap(config.base, config.slots, "base");

  return {
    baseClassNames: Object.fromEntries(
      config.slots.map((slot) => [
        slot,
        hasDefinedStylePart(baseStyles[slot])
          ? createScopedClassName(className, minify, "base-slot", slot)
          : "",
      ]),
    ),
    compoundVariants: (config.compoundVariants ?? []).map((entry, index) => {
      const { css, matches } = expectCompoundVariantEntry(
        entry,
        "slotRecipe",
        index,
        new Set(variantOrder),
      );
      const cssBySlot = expectSlotStyleMap(css, config.slots, `compound variant #${index} css`);

      return {
        classNames: Object.fromEntries(
          config.slots.map((slot) => [
            slot,
            hasDefinedStylePart(cssBySlot[slot])
              ? createScopedClassName(className, minify, "compound-slot", index, slot)
              : "",
          ]),
        ),
        matches,
      };
    }),
    defaultVariants: { ...(config.defaultVariants ?? {}) },
    slots: config.slots,
    variantOrder,
    variants: Object.fromEntries(
      variantOrder.map((axis) => [
        axis,
        Object.fromEntries(
          Object.entries(variants[axis] ?? {}).map(([value, styles]) => {
            const slotStyles = expectSlotStyleMap(
              styles,
              config.slots,
              `variant "${axis}.${value}"`,
            );

            return [
              value,
              Object.fromEntries(
                config.slots.map((slot) => [
                  slot,
                  hasDefinedStylePart(slotStyles[slot])
                    ? createScopedClassName(className, minify, "slot-variant", axis, value, slot)
                    : "",
                ]),
              ),
            ];
          }),
        ),
      ]),
    ),
  };
}

export { BaseProcessor };
