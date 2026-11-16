import type { TailProcessorParams, ValueCache } from "@wyw-in-js/processor-utils";
import type { ExpressionValue, ICSSRule } from "@wyw-in-js/shared";

import type { SlotRecipeExplainEntry } from "./explain-schema.js";
import { createValueNode } from "./serialization.js";
import {
  assertNotAtomShapedClassName,
  type AtomicRecipeNode,
  BaseProcessor,
  collectComposeRefs,
  collectDependencies,
  collectStringMatches,
  collectStyleHandleClassNames,
  createAtomicRecipeNodes,
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
  readOutputModel,
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
    [
      this.className,
      ...Object.values(localRuntimeDefinition.baseClassNames),
      ...Object.values(localRuntimeDefinition.variants).flatMap((values) =>
        Object.values(values).flatMap((classNames) => Object.values(classNames)),
      ),
      ...localRuntimeDefinition.compoundVariants.flatMap(({ classNames }) =>
        Object.values(classNames),
      ),
    ].forEach((className) => {
      if (className.length > 0) {
        assertNotAtomShapedClassName(className);
      }
    });

    if (readOutputModel(this.options) === "atomic") {
      this.buildAtomic(config, localRuntimeDefinition);
      return;
    }

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

  private buildAtomic(
    config: ReturnType<typeof expectSlotRecipeConfig>,
    localRuntimeDefinition: ReturnType<typeof createSlotRecipeRuntimeDefinition>,
  ): void {
    const isDefined = (style: unknown) => style !== undefined && style !== null && style !== false;
    const baseStyles =
      config.base === undefined ? {} : expectSlotStyleMap(config.base, config.slots, "base");
    const classNames = new Map<string, string>();
    const explainEntries: DxStylesExplainEntry[] = [];
    let rules: Record<string, ICSSRule> = {};

    for (const slot of config.slots) {
      const nodes: (AtomicRecipeNode & { readonly entry: SlotRecipeExplainEntry })[] = [];
      const slotBase = baseStyles[slot];

      if (isDefined(slotBase)) {
        reportStylePartDiagnostics(this, slotBase, `slotRecipe() base slot "${slot}"`);
        const className = localRuntimeDefinition.baseClassNames[slot];
        nodes.push({
          className,
          displayName: `${this.displayName}Base${slot}`,
          entry: {
            className,
            composeRefs: collectComposeRefs([slotBase]),
            kind: "slotRecipe",
            node: "base",
            slot,
          },
          node: "base",
          place: `slotRecipe() "${this.displayName}" base slot "${slot}"`,
          style: slotBase,
        });
      }

      for (const axis of localRuntimeDefinition.variantOrder) {
        for (const [value, styles] of Object.entries(config.variants?.[axis] ?? {})) {
          const slotStyle = expectSlotStyleMap(styles, config.slots, `variant "${axis}.${value}"`)[slot];
          if (!isDefined(slotStyle)) {
            continue;
          }

          reportStylePartDiagnostics(
            this,
            slotStyle,
            `slotRecipe() variant "${axis}.${value}" slot "${slot}"`,
          );
          const className = localRuntimeDefinition.variants[axis][value][slot];
          nodes.push({
            className,
            displayName: `${this.displayName}${axis}${value}${slot}`,
            entry: {
              className,
              composeRefs: collectComposeRefs([slotStyle]),
              kind: "slotRecipe",
              node: "variant",
              slot,
              variant: { axis, value },
            },
            node: "variant",
            place: `slotRecipe() "${this.displayName}" variant "${axis}.${value}" slot "${slot}"`,
            style: slotStyle,
            variant: { axis, value },
          });
        }
      }

      localRuntimeDefinition.compoundVariants.forEach((compoundVariant, index) => {
        const slotStyle = expectSlotStyleMap(
          config.compoundVariants?.[index]?.css,
          config.slots,
          `compound variant #${index} css`,
        )[slot];
        if (!isDefined(slotStyle)) {
          return;
        }

        reportStylePartDiagnostics(
          this,
          slotStyle,
          `slotRecipe() compound variant #${index} slot "${slot}"`,
        );
        const className = compoundVariant.classNames[slot];
        nodes.push({
          className,
          displayName: `${this.displayName}Compound${index}${slot}`,
          entry: {
            className,
            composeRefs: collectComposeRefs([slotStyle]),
            kind: "slotRecipe",
            matches: { ...compoundVariant.matches },
            node: "compound",
            slot,
          },
          matches: compoundVariant.matches,
          node: "compound",
          place: `slotRecipe() "${this.displayName}" compound variant #${index} slot "${slot}"`,
          style: slotStyle,
        });
      });

      const built = createAtomicRecipeNodes(
        this.context,
        this.location,
        shouldMinifyClassNames(this.options),
        nodes,
      );
      rules = { ...rules, ...built.rules };
      nodes.forEach((node, index) => {
        classNames.set(node.className, built.parts[index].className);
        explainEntries.push({ ...node.entry, atoms: built.parts[index].atoms });
      });
    }

    const classNameOf = (className: string) => classNames.get(className) ?? className;
    const mapSlots = (record: Record<string, string>) =>
      Object.fromEntries(Object.entries(record).map(([slot, name]) => [slot, classNameOf(name)]));

    this.runtimeDefinition = {
      ...localRuntimeDefinition,
      baseClassNames: mapSlots(localRuntimeDefinition.baseClassNames),
      compoundVariants: localRuntimeDefinition.compoundVariants.map((compoundVariant) => ({
        ...compoundVariant,
        classNames: mapSlots(compoundVariant.classNames),
      })),
      variants: Object.fromEntries(
        Object.entries(localRuntimeDefinition.variants).map(([axis, values]) => [
          axis,
          Object.fromEntries(
            Object.entries(values).map(([value, slotClassNames]) => [value, mapSlots(slotClassNames)]),
          ),
        ]),
      ),
    };
    this.artifacts.push(["css", [rules, []]]);

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
