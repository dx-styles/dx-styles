import type { TailProcessorParams, ValueCache } from "@wyw-in-js/processor-utils";
import type { ExpressionValue } from "@wyw-in-js/shared";

import { createValueNode } from "./serialization.js";
import {
  BaseProcessor,
  collectComposeRefs,
  collectDependencies,
  collectStringMatches,
  collectStyleHandleClassNames,
  createExplainArtifact,
  createImportedPreevalCallNode,
  createPreevalCallNode,
  createSlotRecipeRuntimeDefinition,
  createStylePartRuntimeClassName,
  type DxStylesExplainEntry,
  expectSlotRecipeConfig,
  expectSlotStyleMap,
  getCallExpressions,
  normalizeStyleParts,
  reportStylePartDiagnostics,
  resolveExpressionValue,
  ruleForSelector,
  shouldEmitLocalStyleRule,
  shouldMinifyClassNames,
  toCSSStyle,
} from "./shared.js";

export default class SlotRecipeProcessor extends BaseProcessor {
  private readonly expressions: readonly ExpressionValue[];

  private runtimeDefinition: null | ReturnType<typeof createSlotRecipeRuntimeDefinition>;

  constructor(
    params: ConstructorParameters<typeof BaseProcessor>[0],
    ...args: TailProcessorParams
  ) {
    super([params[0]], ...args);
    this.expressions = getCallExpressions(params);
    collectDependencies(this, this.expressions);
    this.runtimeDefinition = null;
  }

  get asSelector(): string {
    return `.${this.className}`;
  }

  get value(): ReturnType<BaseProcessor["astService"]["callExpression"]> {
    return createPreevalCallNode(
      this.astService,
      this.astService.identifier("preevalSlotRecipe"),
      this.expressions,
    );
  }

  build(values: ValueCache): void {
    const [configExpression] = this.expressions;
    const config = expectSlotRecipeConfig(resolveExpressionValue(configExpression, values));
    const localRuntimeDefinition = createSlotRecipeRuntimeDefinition(
      this.className,
      config,
      shouldMinifyClassNames(this.options),
    );
    const explainEntries: DxStylesExplainEntry[] = [];
    const baseStyles =
      config.base === undefined ? {} : expectSlotStyleMap(config.base, config.slots, "base");
    const runtimeDefinition: typeof localRuntimeDefinition = {
      ...localRuntimeDefinition,
      baseClassNames: Object.fromEntries(
        config.slots.map((slot) => {
          const slotStyle = baseStyles[slot];
          const className = localRuntimeDefinition.baseClassNames[slot];

          return [
            slot,
            slotStyle === undefined || slotStyle === null || slotStyle === false
              ? className
              : createStylePartRuntimeClassName(className, [slotStyle]),
          ];
        }),
      ),
      compoundVariants: localRuntimeDefinition.compoundVariants.map((compoundVariant, index) => {
        const cssBySlot = expectSlotStyleMap(
          config.compoundVariants?.[index]?.css,
          config.slots,
          `compound variant #${index} css`,
        );

        return {
          ...compoundVariant,
          classNames: Object.fromEntries(
            config.slots.map((slot) => {
              const slotStyle = cssBySlot[slot];
              const className = compoundVariant.classNames[slot];

              return [
                slot,
                slotStyle === undefined || slotStyle === null || slotStyle === false
                  ? className
                  : createStylePartRuntimeClassName(className, [slotStyle]),
              ];
            }),
          ),
        };
      }),
      variants: Object.fromEntries(
        localRuntimeDefinition.variantOrder.map((axis) => [
          axis,
          Object.fromEntries(
            Object.entries(localRuntimeDefinition.variants[axis]).map(([value, classNames]) => {
              const slotStyles = expectSlotStyleMap(
                config.variants?.[axis]?.[value],
                config.slots,
                `variant "${axis}.${value}"`,
              );

              return [
                value,
                Object.fromEntries(
                  config.slots.map((slot) => {
                    const slotStyle = slotStyles[slot];
                    const className = classNames[slot];

                    return [
                      slot,
                      slotStyle === undefined || slotStyle === null || slotStyle === false
                        ? className
                        : createStylePartRuntimeClassName(className, [slotStyle]),
                    ];
                  }),
                ),
              ];
            }),
          ),
        ]),
      ),
    };
    this.runtimeDefinition = runtimeDefinition;

    for (const slot of config.slots) {
      const slotStyle = baseStyles[slot];
      if (slotStyle !== undefined && slotStyle !== null && slotStyle !== false) {
        reportStylePartDiagnostics(this, slotStyle, `slotRecipe() base slot "${slot}"`);
        const normalizedStyle = normalizeStyleParts([slotStyle]);
        const styleHandleClassNames = collectStyleHandleClassNames([slotStyle]);
        if (shouldEmitLocalStyleRule(normalizedStyle, styleHandleClassNames)) {
          this.artifacts.push([
            "css",
            [
              ruleForSelector(
                localRuntimeDefinition.baseClassNames[slot],
                `${this.displayName}Base${slot}`,
                toCSSStyle(normalizedStyle),
                this.location,
              ),
              [],
            ],
          ]);
        }
        explainEntries.push({
          className: localRuntimeDefinition.baseClassNames[slot],
          composeRefs: collectComposeRefs([slotStyle]),
          kind: "slotRecipe" as const,
          node: "base" as const,
          slot,
        });
      }
    }

    for (const axis of runtimeDefinition.variantOrder) {
      const valuesByAxis = config.variants?.[axis] ?? {};
      for (const [value, styles] of Object.entries(valuesByAxis)) {
        const slotStyles = expectSlotStyleMap(styles, config.slots, `variant "${axis}.${value}"`);
        for (const slot of config.slots) {
          const slotStyle = slotStyles[slot];
          if (slotStyle === undefined || slotStyle === null || slotStyle === false) {
            continue;
          }

          reportStylePartDiagnostics(
            this,
            slotStyle,
            `slotRecipe() variant "${axis}.${value}" slot "${slot}"`,
          );

          const normalizedStyle = normalizeStyleParts([slotStyle]);
          const styleHandleClassNames = collectStyleHandleClassNames([slotStyle]);
          if (shouldEmitLocalStyleRule(normalizedStyle, styleHandleClassNames)) {
            this.artifacts.push([
              "css",
              [
                ruleForSelector(
                  localRuntimeDefinition.variants[axis][value][slot],
                  `${this.displayName}${axis}${value}${slot}`,
                  toCSSStyle(normalizedStyle),
                  this.location,
                ),
                [],
              ],
            ]);
          }
          explainEntries.push({
            className: localRuntimeDefinition.variants[axis][value][slot],
            composeRefs: collectComposeRefs([slotStyle]),
            kind: "slotRecipe" as const,
            node: "variant" as const,
            slot,
            variant: {
              axis,
              value,
            },
          });
        }
      }
    }

    (config.compoundVariants ?? []).forEach((entry, index) => {
      const cssBySlot = expectSlotStyleMap(
        entry.css,
        config.slots,
        `compound variant #${index} css`,
      );

      for (const slot of config.slots) {
        const slotStyle = cssBySlot[slot];
        if (slotStyle === undefined || slotStyle === null || slotStyle === false) {
          continue;
        }

        reportStylePartDiagnostics(
          this,
          slotStyle,
          `slotRecipe() compound variant #${index} slot "${slot}"`,
        );

        const normalizedStyle = normalizeStyleParts([slotStyle]);
        const styleHandleClassNames = collectStyleHandleClassNames([slotStyle]);
        if (shouldEmitLocalStyleRule(normalizedStyle, styleHandleClassNames)) {
          this.artifacts.push([
            "css",
            [
              ruleForSelector(
                localRuntimeDefinition.compoundVariants[index].classNames[slot],
                `${this.displayName}Compound${index}${slot}`,
                toCSSStyle(normalizedStyle),
                this.location,
              ),
              [],
            ],
          ]);
        }
        explainEntries.push({
          className: localRuntimeDefinition.compoundVariants[index].classNames[slot],
          composeRefs: collectComposeRefs([slotStyle]),
          kind: "slotRecipe" as const,
          matches: collectStringMatches(entry),
          node: "compound" as const,
          slot,
        });
      }
    });

    if (explainEntries.length > 0) {
      this.artifacts.push(createExplainArtifact(explainEntries));
    }
  }

  doEvaltimeReplacement(): void {
    this.replacer(
      () => createImportedPreevalCallNode(this.astService, "preevalSlotRecipe", this.expressions),
      false,
    );
  }

  doRuntimeReplacement(): void {
    if (this.runtimeDefinition === null) {
      throw new Error("dx-styles slotRecipe() runtime definition is not available.");
    }
    const { runtimeDefinition } = this;

    const createRuntimeSlotRecipeImport = this.astService.addNamedImport(
      "createRuntimeSlotRecipe",
      "dx-styles/runtime",
      "createRuntimeSlotRecipe",
    );

    this.replacer(
      () =>
        this.astService.callExpression(createRuntimeSlotRecipeImport, [
          createValueNode(this.astService, runtimeDefinition),
        ]),
      true,
    );
  }
}
