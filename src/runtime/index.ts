import type { RuntimeRecipeDefinition, RuntimeSlotRecipeDefinition } from "../internal";
import { attachRuntimeRecipeDefinition, attachRuntimeSlotRecipeDefinition, cx } from "../internal";

function readRecordValue<TValue>(
  record: Readonly<Record<string, TValue>>,
  key: string,
): TValue | undefined {
  return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
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

function normalizeSelection(
  selection?: Record<string, boolean | string | undefined>,
): Partial<Record<string, string>> {
  if (selection === undefined) {
    return {};
  }

  return Object.keys(selection).reduce<Partial<Record<string, string>>>((acc, key) => {
    const value = selection[key];

    if (value !== undefined) {
      setRecordEntry(acc, key, typeof value === "boolean" ? String(value) : value);
    }

    return acc;
  }, {});
}

function resolveVariants(
  defaults: Record<string, string>,
  next?: Record<string, boolean | string | undefined>,
): Partial<Record<string, string>> {
  const resolvedSelection: Partial<Record<string, string>> = {};

  Object.keys(defaults).forEach((key) => {
    setRecordEntry(resolvedSelection, key, defaults[key]);
  });
  Object.entries(normalizeSelection(next)).forEach(([key, value]) => {
    if (value !== undefined) {
      setRecordEntry(resolvedSelection, key, value);
    }
  });

  return resolvedSelection;
}

function hasAllSlots<TSlot extends string>(
  slots: readonly TSlot[],
  value: Partial<Record<TSlot, string>>,
): value is Record<TSlot, string> {
  return slots.every((slot) => typeof value[slot] === "string");
}

/**
 * Creates a runtime selector over statically compiled recipe class groups.
 */
export function createRuntimeRecipe(
  definition: RuntimeRecipeDefinition,
): (selection?: Record<string, boolean | string | undefined>) => string {
  const recipe = (selection?: Record<string, boolean | string | undefined>) => {
    const resolvedSelection = resolveVariants(definition.defaultVariants, selection);

    const classNames = [
      definition.baseClassName,
      ...definition.variantOrder.map((axis) => {
        const value = resolvedSelection[axis];

        if (value === undefined) {
          return undefined;
        }

        const axisVariants = readRecordValue(definition.variants, axis);
        return axisVariants === undefined ? undefined : readRecordValue(axisVariants, value);
      }),
      ...definition.compoundVariants
        .filter(({ matches }) =>
          Object.entries(matches).every(
            ([axis, expectedValue]) => resolvedSelection[axis] === expectedValue,
          ),
        )
        .map(({ className }) => className),
    ];

    return cx(...classNames);
  };

  return attachRuntimeRecipeDefinition(recipe, definition);
}

/**
 * Creates a runtime selector over statically compiled slot recipe class groups.
 */
export function createRuntimeSlotRecipe<TSlot extends string>(
  definition: RuntimeSlotRecipeDefinition<TSlot>,
): (selection?: Record<string, boolean | string | undefined>) => Record<TSlot, string> {
  const slotRecipe = (selection?: Record<string, boolean | string | undefined>) => {
    const resolvedSelection = resolveVariants(definition.defaultVariants, selection);
    const result: Partial<Record<TSlot, string>> = {};

    definition.slots.forEach((slot) => {
      setRecordEntry(
        result,
        slot,
        cx(
          definition.baseClassNames[slot],
          ...definition.variantOrder.map((axis) => {
            const value = resolvedSelection[axis];

            if (value === undefined) {
              return undefined;
            }

            const axisVariants = readRecordValue(definition.variants, axis);
            if (axisVariants === undefined) {
              return undefined;
            }

            const slotVariants = readRecordValue(axisVariants, value);
            return slotVariants === undefined ? undefined : slotVariants[slot];
          }),
          ...definition.compoundVariants
            .filter(({ matches }) =>
              Object.entries(matches).every(
                ([axis, expectedValue]) => resolvedSelection[axis] === expectedValue,
              ),
            )
            .map(({ classNames }) => classNames[slot]),
        ),
      );
    });

    if (!hasAllSlots(definition.slots, result)) {
      throw new Error("Failed to resolve slot recipe classes.");
    }

    return result;
  };

  return attachRuntimeSlotRecipeDefinition(slotRecipe, definition);
}
