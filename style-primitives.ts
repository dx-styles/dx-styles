import {
  DX_STYLES_DESCRIPTOR_KEY,
  STYLE_HANDLE_DESCRIPTOR_KIND,
} from "./src/style-handle-contract.js";

export {
  DX_STYLES_DESCRIPTOR_KEY,
  STYLE_HANDLE_DESCRIPTOR_KIND,
} from "./src/style-handle-contract.js";

export type StylePrimitive = number | string;
export type StyleEntry =
  | false
  | null
  | readonly StylePrimitive[]
  | StyleObject
  | StylePrimitive
  | true
  | undefined;

export interface StyleObject {
  readonly [key: string]: StyleEntry;
}

export interface StyleHandleRegistry {
  collectStyleHandleClassNames(parts: readonly unknown[]): string[];
  normalizeStyleParts(parts: readonly unknown[]): StyleObject;
  registerStyle(className: string, style: StyleObject): void;
  registerStyleHandleClassName(className: string): void;
}

const RTL_MARKER = "$rtl";
const NOFLIP_MARKER = "$noflip";

function setRecordEntry<TValue>(record: Record<string, TValue>, key: string, value: TValue): void {
  Object.defineProperty(record, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Reflect.getPrototypeOf(value);
  return prototype === null || Reflect.getPrototypeOf(prototype) === null;
}

export function isStylePrimitive(value: unknown): value is StylePrimitive {
  return typeof value === "number" || typeof value === "string";
}

export function isStyleLeafArray(value: unknown): value is readonly StylePrimitive[] {
  return Array.isArray(value) && value.every(isStylePrimitive);
}

export function isStyleObject(value: unknown): value is StyleObject {
  return isPlainObject(value);
}

function isRtlMarkerKey(key: string): boolean {
  return key === RTL_MARKER || key === NOFLIP_MARKER;
}

function readDxStylesDescriptor(value: unknown): null | Record<string, unknown> {
  if (!isPlainObject(value)) {
    return null;
  }

  const descriptor = value[DX_STYLES_DESCRIPTOR_KEY];
  return isPlainObject(descriptor) ? descriptor : null;
}

export function readStyleHandleClassName(value: unknown): null | string {
  const descriptor = readDxStylesDescriptor(value);
  if (
    descriptor?.kind !== STYLE_HANDLE_DESCRIPTOR_KIND ||
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

  if (isRtlMarkerKey(key)) {
    if (value !== true) {
      throw new Error(`dx-styles ${key} marker only accepts true.`);
    }

    return;
  }

  if (value === true) {
    throw new Error(
      `dx-styles style property "${key}" cannot be true; only ${RTL_MARKER} and ${NOFLIP_MARKER} use boolean markers.`,
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

export function readCssDescriptorStyle(value: unknown): null | StyleObject {
  const descriptor = readDxStylesDescriptor(value);
  if (descriptor?.kind !== "css" || !isStyleObject(descriptor.style)) {
    return null;
  }

  return descriptor.style;
}

export function readCssDescriptorClassNameRefs(value: unknown): readonly string[] {
  const descriptor = readDxStylesDescriptor(value);
  if (descriptor?.kind !== "css") {
    return [];
  }

  const { classNameRefs } = descriptor;
  return Array.isArray(classNameRefs)
    ? classNameRefs.filter((className): className is string => typeof className === "string")
    : [];
}

export function hasCssDescriptorMarker(value: unknown): boolean {
  return readDxStylesDescriptor(value)?.kind === "css";
}

export function isStyleHandle(value: unknown): boolean {
  return readStyleHandleClassName(value) !== null;
}

function splitClassNameTokens(className: string): string[] {
  return className.split(/\s+/u).filter((token) => token.length > 0);
}

export function normalizeStyleHandleClassName(className: string): string {
  const normalizedClassName = Array.from(new Set(splitClassNameTokens(className))).join(" ");
  if (normalizedClassName.length === 0) {
    throw new Error("dx-styles style handles require a non-empty class name.");
  }

  return normalizedClassName;
}

export function cloneStyleObject(style: StyleObject): StyleObject {
  const clone: Record<string, StyleEntry> = {};

  return Object.entries(style).reduce((acc, [key, value]) => {
    assertValidStyleEntry(key, value);

    if (isStyleObject(value)) {
      setRecordEntry(acc, key, cloneStyleObject(value));
      return acc;
    }

    if (isStyleLeafArray(value)) {
      setRecordEntry(acc, key, [...value]);
      return acc;
    }

    setRecordEntry(acc, key, value);
    return acc;
  }, clone);
}

export function cloneStyleEntry(entry: StyleEntry): StyleEntry {
  if (isStyleObject(entry)) {
    return cloneStyleObject(entry);
  }

  if (isStyleLeafArray(entry)) {
    return [...entry];
  }

  return entry;
}

export function mergeStyleObjects(base: StyleObject, next: StyleObject): StyleObject {
  const initial = cloneStyleObject(base);

  return Object.entries(next).reduce((acc, [key, value]) => {
    assertValidStyleEntry(key, value);

    if (value === undefined || value === null || value === false) {
      return acc;
    }

    if (isStyleObject(acc[key]) && isStyleObject(value)) {
      setRecordEntry(acc, key, mergeStyleObjects(acc[key], value));
      return acc;
    }

    setRecordEntry(acc, key, cloneStyleEntry(value));

    return acc;
  }, initial);
}

export function resolveStylePartWith(
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

    return styles.reduce<StyleObject>((acc, style) => mergeStyleObjects(acc, style ?? {}), {});
  }

  const cssDescriptorStyle = readCssDescriptorStyle(part);
  if (cssDescriptorStyle !== null) {
    return cloneStyleObject(cssDescriptorStyle);
  }

  if (isStyleHandle(part)) {
    return {};
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

export function normalizeStylePartsWith(
  parts: readonly unknown[],
  readToken: (token: string) => null | StyleObject,
): StyleObject {
  return parts.reduce<StyleObject>(
    (acc, part) => mergeStyleObjects(acc, resolveStylePartWith(part, readToken)),
    {},
  );
}

export function createStyleHandleRegistry(): StyleHandleRegistry {
  const styleRegistry = new Map<string, StyleObject>();
  const classRefRegistry = new Set<string>();

  function readRegisteredStyleToken(token: string): null | StyleObject {
    if (classRefRegistry.has(token)) {
      return {};
    }

    const style = styleRegistry.get(token);
    return style === undefined ? null : cloneStyleObject(style);
  }

  function registerStyleHandleClassName(className: string): void {
    splitClassNameTokens(className).forEach((token) => {
      classRefRegistry.add(token);

      if (!styleRegistry.has(token)) {
        styleRegistry.set(token, {});
      }
    });
  }

  return {
    collectStyleHandleClassNames(parts) {
      const seen = new Set<string>();

      parts.forEach((part) => {
        if (typeof part === "string") {
          splitClassNameTokens(part)
            .filter((token) => classRefRegistry.has(token))
            .forEach((token) => {
              seen.add(token);
            });
          return;
        }

        const descriptorClassNameRefs = readCssDescriptorClassNameRefs(part);
        if (descriptorClassNameRefs.length > 0) {
          descriptorClassNameRefs.forEach((className) => {
            registerStyleHandleClassName(className);
            seen.add(className);
          });
          return;
        }

        const className = readStyleHandleClassName(part);
        if (className === null) {
          return;
        }

        registerStyleHandleClassName(className);
        splitClassNameTokens(className).forEach((token) => {
          seen.add(token);
        });
      });

      return [...seen];
    },
    normalizeStyleParts(parts) {
      return normalizeStylePartsWith(parts, readRegisteredStyleToken);
    },
    registerStyle(className, style) {
      styleRegistry.set(className, cloneStyleObject(style));
    },
    registerStyleHandleClassName,
  };
}

export function hashString(source: string): string {
  const hash = source.split("").reduce((acc, character) => {
    return (acc * 33 + character.charCodeAt(0)) % 2147483647;
  }, 5381);

  return hash.toString(36);
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  if (isPlainObject(value)) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

export function createRuntimeClassName(prefix: string, value: unknown): string {
  return `${prefix}_${hashString(stableStringify(value))}`;
}

export function flattenContractAssignments(
  contract: unknown,
  values: unknown,
  allowPartial: boolean,
): Record<string, StylePrimitive> {
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

  const result: Record<string, StylePrimitive> = {};

  return Object.entries(contract).reduce((acc, [key, contractValue]) => {
    const nextValue = values[key];

    if (nextValue === undefined || nextValue === null) {
      if (!allowPartial) {
        throw new Error(`Missing value for "${key}".`);
      }

      return acc;
    }

    if (isPlainObject(contractValue)) {
      if (!isPlainObject(nextValue)) {
        throw new Error(`Invalid value for "${key}".`);
      }

      Object.assign(acc, flattenContractAssignments(contractValue, nextValue, allowPartial));
      return acc;
    }

    if (typeof contractValue !== "string") {
      if (allowPartial) {
        return acc;
      }

      throw new Error(`Missing contract leaf for "${key}".`);
    }

    const match = /^var\((--[^)]+)\)$/u.exec(contractValue);
    if (!match) {
      if (allowPartial) {
        return acc;
      }

      throw new Error(`Invalid contract leaf for "${key}".`);
    }

    if (typeof nextValue !== "number" && typeof nextValue !== "string") {
      throw new Error(`Invalid value for "${key}".`);
    }

    acc[match[1]] = nextValue;

    return acc;
  }, result);
}

export interface TokenContractObject {
  readonly [key: string]: string | TokenContractObject;
}

function buildContractLeafName(
  prefix: string,
  path: readonly string[],
  explicitName: null | string,
): string {
  const leafName = explicitName !== null && explicitName.length > 0 ? explicitName : path.join("-");
  return leafName.startsWith("--") ? leafName : `--${prefix}-${leafName}`;
}

function buildContractObject(
  shape: Record<string, unknown>,
  prefix: string,
  path: readonly string[],
): TokenContractObject {
  const result: Record<string, string | TokenContractObject> = {};

  return Object.keys(shape).reduce((acc, key) => {
    const value = shape[key];
    const nextPath = [...path, key];

    if (isPlainObject(value)) {
      setRecordEntry(acc, key, buildContractObject(value, prefix, nextPath));
      return acc;
    }

    setRecordEntry(
      acc,
      key,
      `var(${buildContractLeafName(prefix, nextPath, typeof value === "string" ? value : null)})`,
    );

    return acc;
  }, result);
}

/**
 * Builds a token contract: a (possibly nested) object whose leaves are
 * `var(--<prefix>-<path>)` strings. Leaf names come from the dotted path unless
 * the shape supplies an explicit string (used verbatim when it already starts
 * with `--`, otherwise prefixed).
 *
 * The output is a pure function of `(shape, prefix)`, so the `createTokenContract`
 * WyW processor — which serializes this into a static object literal — and the
 * runtime fallback in `internal.ts` produce byte-identical names. Sharing this
 * one builder is what keeps build-time extraction and runtime in lockstep.
 */
export function buildTokenContract(
  shape: unknown,
  options: undefined | { readonly prefix: string },
): TokenContractObject {
  const prefix = typeof options?.prefix === "string" ? options.prefix.trim() : "";
  if (prefix.length === 0) {
    throw new Error("dx-styles createTokenContract() requires a non-empty prefix.");
  }

  if (!isPlainObject(shape)) {
    throw new Error(
      "dx-styles createTokenContract() requires a statically analyzable shape object.",
    );
  }

  return buildContractObject(shape, prefix, []);
}
