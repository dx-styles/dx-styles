import type { TailProcessorParams, ValueCache } from "@wyw-in-js/processor-utils";
import type { ExpressionValue } from "@wyw-in-js/shared";

import { expectKeyframesConfig } from "../style-primitives.js";
import { toCSS } from "./serialization.js";
import {
  BaseProcessor,
  collectDependencies,
  createExplainArtifact,
  createRuntimeClassName,
  getCallExpressions,
  resolveExpressionValue,
  ruleForKeyframes,
} from "./shared.js";

/**
 * `keyframes()` declares a shareable @keyframes animation. The animation name
 * is the processor class name — deterministic per file + call index, exactly
 * like `css()` classes — and does not depend on the frame values, so the call
 * is replaced in both the eval and runtime phases with the bare name string
 * (the `createVar` pattern). Dependent modules embed it as a plain value
 * (`animation: \`${spin} 1s\``); only this processor emits the top-level
 * `@keyframes` rule, resolved from the frames at build time.
 */
export default class KeyframesProcessor extends BaseProcessor {
  private readonly expressions: readonly ExpressionValue[];

  constructor(
    params: ConstructorParameters<typeof BaseProcessor>[0],
    ...args: TailProcessorParams
  ) {
    super([params[0]], ...args);
    this.expressions = getCallExpressions(params);
    if (this.expressions.length !== 1) {
      throw new Error("dx-styles keyframes() takes exactly one keyframes object.");
    }

    collectDependencies(this, this.expressions);
  }

  get asSelector(): string {
    return this.className;
  }

  get value(): ReturnType<BaseProcessor["astService"]["stringLiteral"]> {
    return this.astService.stringLiteral(this.className);
  }

  build(values: ValueCache): void {
    const frames = expectKeyframesConfig(resolveExpressionValue(this.expressions[0], values));

    this.artifacts.push([
      "css",
      [ruleForKeyframes(this.className, this.displayName, toCSS(frames), this.location), []],
    ]);
    this.artifacts.push(
      createExplainArtifact([
        {
          className: this.className,
          composeRefs: [],
          frames: Object.keys(frames).sort((left, right) => left.localeCompare(right)),
          kind: "keyframes",
          node: "keyframes",
          preevalClassName: createRuntimeClassName("dxk", frames),
        },
      ]),
    );
  }

  doEvaltimeReplacement(): void {
    this.replacer(this.astService.stringLiteral(this.className), false);
  }

  doRuntimeReplacement(): void {
    this.replacer(this.astService.stringLiteral(this.className), false);
  }
}
