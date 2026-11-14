import type { TailProcessorParams, ValueCache } from "@wyw-in-js/processor-utils";
import type { ExpressionValue } from "@wyw-in-js/shared";

import { createValueNode } from "./serialization.js";
import {
  assertAtomicPreprocessor,
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
  createRecipeRuntimeDefinition,
  createStylePartRuntimeClassName,
  type DxStylesExplainEntry,
  expectRecipeConfig,
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

export default class RecipeProcessor extends BaseProcessor {
  private readonly expressions: readonly ExpressionValue[];

  private runtimeDefinition: null | ReturnType<typeof createRecipeRuntimeDefinition>;

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
      this.astService.identifier("preevalRecipe"),
      this.expressions,
    );
  }

  build(values: ValueCache): void {
    const [configExpression] = this.expressions;
    const config = expectRecipeConfig(resolveExpressionValue(configExpression, values));
    const localRuntimeDefinition = createRecipeRuntimeDefinition(
      this.className,
      config,
      shouldMinifyClassNames(this.options),
    );
    [
      this.className,
      localRuntimeDefinition.baseClassName,
      ...Object.values(localRuntimeDefinition.variants).flatMap((values) => Object.values(values)),
      ...localRuntimeDefinition.compoundVariants.map(({ className }) => className),
    ].forEach((className) => {
      if (className !== undefined) {
        assertNotAtomShapedClassName(className);
      }
    });

    if (readOutputModel(this.options) === "atomic") {
      this.buildAtomic(config, localRuntimeDefinition);
      return;
    }

    const runtimeBaseClassName =
      localRuntimeDefinition.baseClassName !== undefined && config.base !== undefined
        ? createStylePartRuntimeClassName(localRuntimeDefinition.baseClassName, [config.base])
        : localRuntimeDefinition.baseClassName;
    const runtimeDefinition: typeof localRuntimeDefinition = {
      ...localRuntimeDefinition,
      baseClassName: runtimeBaseClassName,
      compoundVariants: localRuntimeDefinition.compoundVariants.map((compoundVariant, index) => {
        const style = config.compoundVariants?.[index]?.css;

        return {
          ...compoundVariant,
          className:
            style === undefined
              ? compoundVariant.className
              : createStylePartRuntimeClassName(compoundVariant.className, [style]),
        };
      }),
      variants: Object.fromEntries(
        localRuntimeDefinition.variantOrder.map((axis) => [
          axis,
          Object.fromEntries(
            Object.entries(localRuntimeDefinition.variants[axis]).map(([value, className]) => [
              value,
              createStylePartRuntimeClassName(className, [config.variants?.[axis]?.[value]]),
            ]),
          ),
        ]),
      ),
    };
    const explainEntries: DxStylesExplainEntry[] = [];
    this.runtimeDefinition = runtimeDefinition;

    if (config.base !== undefined && config.base !== null && config.base !== false) {
      reportStylePartDiagnostics(this, config.base, "recipe() base");
      const baseStyle = normalizeStyleParts([config.base]);
      const styleHandleClassNames = collectStyleHandleClassNames([config.base]);
      if (shouldEmitLocalStyleRule(baseStyle, styleHandleClassNames)) {
        this.artifacts.push([
          "css",
          [
            ruleForSelector(
              localRuntimeDefinition.baseClassName ?? "",
              `${this.displayName}Base`,
              toCSSStyle(baseStyle),
              this.location,
            ),
            [],
          ],
        ]);
      }
      explainEntries.push({
        className: localRuntimeDefinition.baseClassName ?? "",
        composeRefs: collectComposeRefs([config.base]),
        kind: "recipe" as const,
        node: "base" as const,
      });
    }

    for (const axis of runtimeDefinition.variantOrder) {
      const valuesByAxis = config.variants?.[axis] ?? {};
      for (const [value, style] of Object.entries(valuesByAxis)) {
        reportStylePartDiagnostics(this, style, `recipe() variant "${axis}.${value}"`);
        const normalizedStyle = normalizeStyleParts([style]);
        const styleHandleClassNames = collectStyleHandleClassNames([style]);
        if (shouldEmitLocalStyleRule(normalizedStyle, styleHandleClassNames)) {
          this.artifacts.push([
            "css",
            [
              ruleForSelector(
                localRuntimeDefinition.variants[axis][value],
                `${this.displayName}${axis}${value}`,
                toCSSStyle(normalizedStyle),
                this.location,
              ),
              [],
            ],
          ]);
        }
        explainEntries.push({
          className: localRuntimeDefinition.variants[axis][value],
          composeRefs: collectComposeRefs([style]),
          kind: "recipe" as const,
          node: "variant" as const,
          variant: {
            axis,
            value,
          },
        });
      }
    }

    (config.compoundVariants ?? []).forEach((entry, index) => {
      reportStylePartDiagnostics(this, entry.css, `recipe() compound variant #${index}`);
      const normalizedStyle = normalizeStyleParts([entry.css]);
      const styleHandleClassNames = collectStyleHandleClassNames([entry.css]);
      if (shouldEmitLocalStyleRule(normalizedStyle, styleHandleClassNames)) {
        this.artifacts.push([
          "css",
          [
            ruleForSelector(
              localRuntimeDefinition.compoundVariants[index].className,
              `${this.displayName}Compound${index}`,
              toCSSStyle(normalizedStyle),
              this.location,
            ),
            [],
          ],
        ]);
      }
      explainEntries.push({
        className: localRuntimeDefinition.compoundVariants[index].className,
        composeRefs: collectComposeRefs([entry.css]),
        kind: "recipe" as const,
        matches: collectStringMatches(entry),
        node: "compound" as const,
      });
    });

    if (explainEntries.length > 0) {
      this.artifacts.push(createExplainArtifact(explainEntries));
    }
  }

  private buildAtomic(
    config: ReturnType<typeof expectRecipeConfig>,
    localRuntimeDefinition: ReturnType<typeof createRecipeRuntimeDefinition>,
  ): void {
    assertAtomicPreprocessor(this.options);
    const nodes: (AtomicRecipeNode & { readonly composeRefs: readonly string[] })[] = [];

    if (config.base !== undefined && config.base !== null && config.base !== false) {
      reportStylePartDiagnostics(this, config.base, "recipe() base");
      nodes.push({
        className: localRuntimeDefinition.baseClassName ?? "",
        composeRefs: collectComposeRefs([config.base]),
        displayName: `${this.displayName}Base`,
        node: "base",
        place: `recipe() "${this.displayName}" base`,
        style: config.base,
      });
    }

    for (const axis of localRuntimeDefinition.variantOrder) {
      for (const [value, style] of Object.entries(config.variants?.[axis] ?? {})) {
        reportStylePartDiagnostics(this, style, `recipe() variant "${axis}.${value}"`);
        nodes.push({
          className: localRuntimeDefinition.variants[axis][value],
          composeRefs: collectComposeRefs([style]),
          displayName: `${this.displayName}${axis}${value}`,
          node: "variant",
          place: `recipe() "${this.displayName}" variant "${axis}.${value}"`,
          style,
          variant: { axis, value },
        });
      }
    }

    localRuntimeDefinition.compoundVariants.forEach((compoundVariant, index) => {
      const entry = config.compoundVariants?.[index];
      reportStylePartDiagnostics(this, entry?.css, `recipe() compound variant #${index}`);
      nodes.push({
        className: compoundVariant.className,
        composeRefs: collectComposeRefs([entry?.css]),
        displayName: `${this.displayName}Compound${index}`,
        matches: compoundVariant.matches,
        node: "compound",
        place: `recipe() "${this.displayName}" compound variant #${index}`,
        style: entry?.css,
      });
    });

    const { parts, rules } = createAtomicRecipeNodes(
      this.context,
      this.location,
      shouldMinifyClassNames(this.options),
      nodes,
    );
    const classNameOf = (className: string | undefined) =>
      parts[nodes.findIndex((node) => node.className === className)]?.className ?? className;

    this.runtimeDefinition = {
      ...localRuntimeDefinition,
      baseClassName:
        localRuntimeDefinition.baseClassName === undefined
          ? undefined
          : classNameOf(localRuntimeDefinition.baseClassName),
      compoundVariants: localRuntimeDefinition.compoundVariants.map((compoundVariant) => ({
        ...compoundVariant,
        className: classNameOf(compoundVariant.className) ?? compoundVariant.className,
      })),
      variants: Object.fromEntries(
        localRuntimeDefinition.variantOrder.map((axis) => [
          axis,
          Object.fromEntries(
            Object.entries(localRuntimeDefinition.variants[axis]).map(([value, className]) => [
              value,
              classNameOf(className) ?? className,
            ]),
          ),
        ]),
      ),
    };
    this.artifacts.push(["css", [rules, []]]);

    if (nodes.length > 0) {
      this.artifacts.push(
        createExplainArtifact(
          nodes.map((node, index): DxStylesExplainEntry => {
            const common = {
              atoms: parts[index].atoms,
              className: node.className,
              composeRefs: node.composeRefs,
              kind: "recipe" as const,
            };

            if (node.node === "variant" && node.variant !== undefined) {
              return { ...common, node: "variant", variant: node.variant };
            }

            if (node.node === "compound") {
              return { ...common, matches: { ...node.matches }, node: "compound" };
            }

            return { ...common, node: "base" };
          }),
        ),
      );
    }
  }

  doEvaltimeReplacement(): void {
    this.replacer(
      () => createImportedPreevalCallNode(this.astService, "preevalRecipe", this.expressions),
      false,
    );
  }

  doRuntimeReplacement(): void {
    if (this.runtimeDefinition === null) {
      throw new Error("dx-styles recipe() runtime definition is not available.");
    }
    const { runtimeDefinition } = this;

    const createRuntimeRecipeImport = this.astService.addNamedImport(
      "createRuntimeRecipe",
      "dx-styles/runtime",
      "createRuntimeRecipe",
    );

    this.replacer(
      () =>
        this.astService.callExpression(createRuntimeRecipeImport, [
          createValueNode(this.astService, runtimeDefinition),
        ]),
      true,
    );
  }
}
