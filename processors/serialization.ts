import type { BaseProcessor, Expression } from "@wyw-in-js/processor-utils";

export type CssSerializableValue =
  | number
  | string
  | readonly CssSerializableValue[]
  | { readonly [key: string]: CssSerializableValue };

export type RuntimeSerializableValue =
  | boolean
  | null
  | number
  | string
  | readonly RuntimeSerializableValue[]
  | RuntimeSerializableObject;

export interface RuntimeSerializableObject {
  readonly [key: string]: RuntimeSerializableValue | undefined;
}

type RuntimeSerializableField<T> = T extends undefined ? undefined : RuntimeSerializable<T>;

export type RuntimeSerializable<T> = T extends (...args: never[]) => unknown
  ? never
  : T extends boolean | null | number | string
    ? T
    : T extends readonly (infer TItem)[]
      ? readonly RuntimeSerializableField<TItem>[]
      : T extends object
        ? { readonly [TKey in keyof T]: RuntimeSerializableField<T[TKey]> }
        : never;

const unitlessCssProperties = new Set([
  "animationIterationCount",
  "aspectRatio",
  "borderImageOutset",
  "borderImageSlice",
  "borderImageWidth",
  "boxFlex",
  "boxFlexGroup",
  "boxOrdinalGroup",
  "columnCount",
  "columns",
  "flex",
  "flexGrow",
  "flexPositive",
  "flexShrink",
  "flexNegative",
  "flexOrder",
  "fontWeight",
  "gridArea",
  "gridColumn",
  "gridColumnEnd",
  "gridColumnSpan",
  "gridColumnStart",
  "gridRow",
  "gridRowEnd",
  "gridRowSpan",
  "gridRowStart",
  "lineClamp",
  "lineHeight",
  "opacity",
  "order",
  "orphans",
  "scale",
  "tabSize",
  "widows",
  "zIndex",
  "zoom",
  "fillOpacity",
  "floodOpacity",
  "stopOpacity",
  "strokeDasharray",
  "strokeDashoffset",
  "strokeMiterlimit",
  "strokeOpacity",
  "strokeWidth",
]);

function hyphenateCssProperty(property: string): string {
  if (property.startsWith("--")) {
    return property;
  }

  return property
    .replace(/([A-Z])/gu, "-$1")
    .replace(/^ms-/u, "-ms-")
    .toLowerCase();
}

function normalizeUnitlessProperty(property: string): string {
  return property.replace(/^(Webkit|Moz|O|ms)([A-Z])(.+)$/u, (_, __, first, rest) => {
    return `${String(first).toLowerCase()}${String(rest)}`;
  });
}

function formatCssPropertyValue(property: string, value: number | string): string {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`dx-styles style property "${property}" must be a finite number.`);
    }

    if (value !== 0 && !unitlessCssProperties.has(normalizeUnitlessProperty(property))) {
      return `${value}px`;
    }
  }

  return String(value);
}

export function toCSS(value: CssSerializableValue): string {
  if (Array.isArray(value)) {
    return value.map(toCSS).join("\n");
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("dx-styles CSS values must be finite numbers.");
    }

    return String(value);
  }

  if (typeof value === "string") {
    return value;
  }

  return Object.entries(value)
    .filter(([, entry]) => typeof entry === "number" || Boolean(entry))
    .map(([property, entry]) => {
      if (typeof entry === "number" || typeof entry === "string") {
        return `${hyphenateCssProperty(property)}:${formatCssPropertyValue(property, entry)};`;
      }

      if (Array.isArray(entry)) {
        return entry
          .map((item) => {
            if (typeof item !== "number" && typeof item !== "string") {
              throw new Error(
                `dx-styles style property "${property}" cannot use non-primitive array values.`,
              );
            }

            return `${hyphenateCssProperty(property)}:${formatCssPropertyValue(property, item)};`;
          })
          .join("");
      }

      return `${property}{${toCSS(entry)}}`;
    })
    .join("");
}

function createUnknownValueNode(
  astService: BaseProcessor["astService"],
  value: unknown,
): Expression {
  if (value === undefined) {
    return astService.identifier("undefined");
  }

  if (value === null) {
    return astService.nullLiteral();
  }

  if (Array.isArray(value)) {
    return astService.arrayExpression(
      value.map((entry) => createUnknownValueNode(astService, entry)),
    );
  }

  if (typeof value === "boolean") {
    return astService.booleanLiteral(value);
  }

  if (typeof value === "number") {
    return astService.numericLiteral(value);
  }

  if (typeof value === "string") {
    return astService.stringLiteral(value);
  }

  if (isRuntimeSerializableRecord(value)) {
    return createObjectValueNode(astService, Object.entries(value));
  }

  throw new Error(`Unsupported runtime value type: ${typeof value}.`);
}

function isRuntimeSerializableRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function createObjectValueNode(
  astService: BaseProcessor["astService"],
  entries: readonly (readonly [string, unknown])[],
): Expression {
  if (entries.some(([key]) => key === "__proto__")) {
    return astService.callExpression(
      astService.memberExpression(
        astService.identifier("Object"),
        astService.identifier("fromEntries"),
      ),
      [
        astService.arrayExpression(
          entries.map(([key, entry]) =>
            astService.arrayExpression([
              astService.stringLiteral(key),
              createUnknownValueNode(astService, entry),
            ]),
          ),
        ),
      ],
    );
  }

  return astService.objectExpression(
    entries.map(([key, entry]) =>
      astService.objectProperty(
        astService.stringLiteral(key),
        createUnknownValueNode(astService, entry),
      ),
    ),
  );
}

export function createValueNode<T>(
  astService: BaseProcessor["astService"],
  value: RuntimeSerializable<T>,
): Expression {
  return createUnknownValueNode(astService, value);
}
