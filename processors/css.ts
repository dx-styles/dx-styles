import type { TailProcessorParams, ValueCache } from "@wyw-in-js/processor-utils";
import type { ExpressionValue } from "@wyw-in-js/shared";

import {
  BaseProcessor,
  collectComposeRefs,
  collectDependencies,
  collectStyleHandleClassNames,
  composeClassNames,
  createExplainArtifact,
  createImportedPreevalCallNode,
  createPreevalCallNode,
  createRuntimeClassName,
  getCallExpressions,
  normalizeStyleParts,
  registerExtractedStyle,
  reportStylePartDiagnostics,
  resolveExpressionValue,
  ruleForSelector,
  shouldEmitLocalStyleRule,
  toCSSStyle,
} from "./shared.js";

export default class CssProcessor extends BaseProcessor {
  private readonly expressions: readonly ExpressionValue[];

  private resolvedStyle: ReturnType<typeof normalizeStyleParts>;

  private runtimeClassName: string;

  constructor(
    params: ConstructorParameters<typeof BaseProcessor>[0],
    ...args: TailProcessorParams
  ) {
    super([params[0]], ...args);
    this.expressions = getCallExpressions(params);
    collectDependencies(this, this.expressions);
    this.resolvedStyle = {};
    this.runtimeClassName = this.className;
  }

  get asSelector(): string {
    return `.${this.className}`;
  }

  get value(): ReturnType<BaseProcessor["astService"]["callExpression"]> {
    return createPreevalCallNode(
      this.astService,
      this.astService.identifier("preevalCss"),
      this.expressions,
    );
  }

  build(values: ValueCache): void {
    const resolvedParts = this.expressions.map((expression) =>
      resolveExpressionValue(expression, values),
    );
    resolvedParts.forEach((part) => {
      reportStylePartDiagnostics(this, part, "css()");
    });
    const composeRefs = collectComposeRefs(resolvedParts);
    const styleHandleClassNames = collectStyleHandleClassNames(resolvedParts);
    this.resolvedStyle = normalizeStyleParts(resolvedParts);
    const shouldEmitLocalRule = shouldEmitLocalStyleRule(this.resolvedStyle, styleHandleClassNames);
    this.runtimeClassName = composeClassNames(
      ...styleHandleClassNames,
      shouldEmitLocalRule ? this.className : undefined,
    );
    registerExtractedStyle(this.className, this.resolvedStyle);
    if (shouldEmitLocalRule) {
      this.artifacts.push([
        "css",
        [
          ruleForSelector(
            this.className,
            this.displayName,
            toCSSStyle(this.resolvedStyle),
            this.location,
          ),
          [],
        ],
      ]);
    }
    this.artifacts.push(
      createExplainArtifact([
        {
          className: this.className,
          composeRefs,
          kind: "css",
          node: "style",
          preevalClassName: createRuntimeClassName("dxs", this.resolvedStyle),
        },
      ]),
    );
  }

  doEvaltimeReplacement(): void {
    this.replacer(
      () => createImportedPreevalCallNode(this.astService, "preevalCss", this.expressions),
      false,
    );
  }

  doRuntimeReplacement(): void {
    this.replacer(this.astService.stringLiteral(this.runtimeClassName), false);
  }
}
