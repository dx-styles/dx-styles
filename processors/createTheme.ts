import type { TailProcessorParams, ValueCache } from "@wyw-in-js/processor-utils";
import type { ExpressionValue } from "@wyw-in-js/shared";

import { toCSS } from "./serialization.js";
import {
  BaseProcessor,
  collectDependencies,
  createExplainArtifact,
  createImportedPreevalCallNode,
  createPreevalCallNode,
  createRuntimeClassName,
  flattenContractAssignments,
  getCallExpressions,
  resolveExpressionValue,
  ruleForSelector,
} from "./shared.js";

export default class CreateThemeProcessor extends BaseProcessor {
  private readonly expressions: readonly ExpressionValue[];

  constructor(
    params: ConstructorParameters<typeof BaseProcessor>[0],
    ...args: TailProcessorParams
  ) {
    super([params[0]], ...args);
    this.expressions = getCallExpressions(params);
    collectDependencies(this, this.expressions);
  }

  get asSelector(): string {
    return `.${this.className}`;
  }

  get value(): ReturnType<BaseProcessor["astService"]["callExpression"]> {
    return createPreevalCallNode(
      this.astService,
      this.astService.identifier("preevalCreateTheme"),
      this.expressions,
    );
  }

  build(values: ValueCache): void {
    const [contractExpression, valueExpression] = this.expressions;
    const contract = resolveExpressionValue(contractExpression, values);
    const themeValues = resolveExpressionValue(valueExpression, values);
    const assignments = flattenContractAssignments(contract, themeValues, false);

    this.artifacts.push([
      "css",
      [ruleForSelector(this.className, this.displayName, toCSS(assignments), this.location), []],
    ]);
    this.artifacts.push(
      createExplainArtifact([
        {
          className: this.className,
          composeRefs: [],
          kind: "theme",
          node: "theme",
          preevalClassName: createRuntimeClassName("dxt", assignments),
          variables: Object.keys(assignments).sort(),
        },
      ]),
    );
  }

  doEvaltimeReplacement(): void {
    this.replacer(
      () => createImportedPreevalCallNode(this.astService, "preevalCreateTheme", this.expressions),
      false,
    );
  }

  doRuntimeReplacement(): void {
    this.replacer(this.astService.stringLiteral(this.className), false);
  }
}
