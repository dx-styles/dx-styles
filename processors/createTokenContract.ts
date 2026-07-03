import type { TailProcessorParams, ValueCache } from "@wyw-in-js/processor-utils";
import type { ExpressionValue } from "@wyw-in-js/shared";

import { createValueNode } from "./serialization.js";
import {
  BaseProcessor,
  buildTokenContract,
  collectDependencies,
  createImportedPreevalCallNode,
  createPreevalCallNode,
  getCallExpressions,
  resolveExpressionValue,
  type TokenContractObject,
} from "./shared.js";

/**
 * `createTokenContract()` declares a public token contract: a (possibly nested)
 * object whose leaves are `var(--<prefix>-<path>)` strings with stable, readable
 * names that consumers depend on. It is the "public" counterpart to `createVar`,
 * whose names are private and hashed.
 *
 * As a processor the call is replaced with the resolved contract itself — a plain
 * object literal at runtime, a `preevalCreateTokenContract()` shim at eval time —
 * instead of being left as a live `createTokenContract()` call. That keeps the
 * contract's construction out of the eval graph of every style file that reads it
 * (the call is no longer re-executed per consumer; downstream sees a literal).
 *
 * The names are a pure function of the `(shape, prefix)` arguments, so this
 * build-time output is byte-identical to the runtime fallback in `internal.ts`;
 * both delegate to the shared `buildTokenContract`. The call emits no CSS of its
 * own — `createTheme()`/`assignVars()` consume the contract and emit the rules.
 */
export default class CreateTokenContractProcessor extends BaseProcessor {
  private readonly expressions: readonly ExpressionValue[];

  private contract: null | TokenContractObject;

  constructor(
    params: ConstructorParameters<typeof BaseProcessor>[0],
    ...args: TailProcessorParams
  ) {
    super([params[0]], ...args);
    this.expressions = getCallExpressions(params);
    collectDependencies(this, this.expressions);
    this.contract = null;
  }

  get asSelector(): string {
    return `.${this.className}`;
  }

  get value(): ReturnType<BaseProcessor["astService"]["callExpression"]> {
    return createPreevalCallNode(
      this.astService,
      this.astService.identifier("preevalCreateTokenContract"),
      this.expressions,
    );
  }

  build(values: ValueCache): void {
    const shape = resolveExpressionValue(this.expressions[0], values);
    const options =
      this.expressions.length < 2
        ? undefined
        : (resolveExpressionValue(this.expressions[1], values) as
            | undefined
            | { readonly prefix: string });

    this.contract = buildTokenContract(shape, options);
  }

  doEvaltimeReplacement(): void {
    this.replacer(
      () =>
        createImportedPreevalCallNode(
          this.astService,
          "preevalCreateTokenContract",
          this.expressions,
        ),
      false,
    );
  }

  doRuntimeReplacement(): void {
    if (this.contract === null) {
      throw new Error("dx-styles createTokenContract() contract is not available.");
    }
    const { contract } = this;

    this.replacer(() => createValueNode(this.astService, contract), false);
  }
}
