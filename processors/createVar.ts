import type { TailProcessorParams } from "@wyw-in-js/processor-utils";

import { BaseProcessor } from "./shared.js";

/**
 * `createVar()` declares a private CSS custom property whose name is hashed at
 * build time (via the processor slug — unique per file + call index, like class
 * names). It is the explicit "internal" counterpart to `createTokenContract`,
 * which emits stable readable names that are a public contract.
 *
 * The name does not depend on any runtime value, so the call is replaced — in
 * both the eval and runtime phases — with its value-form string `var(--<slug>)`.
 * Used as a value (`color: bg`) it works natively; for declarations it is unwrapped
 * by `assignVars`/`setVar` back to the bare `--<slug>` name.
 */
export default class CreateVarProcessor extends BaseProcessor {
  private readonly varName: string;

  constructor(
    params: ConstructorParameters<typeof BaseProcessor>[0],
    ...args: TailProcessorParams
  ) {
    super([params[0]], ...args);
    this.varName = `--${this.className}`;
  }

  get asSelector(): string {
    return this.toValueForm();
  }

  get value(): ReturnType<BaseProcessor["astService"]["stringLiteral"]> {
    return this.astService.stringLiteral(this.toValueForm());
  }

  build(): void {
    // createVar() only names a custom property; the declaring css()/assignVars call
    // emits the actual CSS, so there is nothing to extract here.
  }

  doEvaltimeReplacement(): void {
    this.replacer(this.astService.stringLiteral(this.toValueForm()), false);
  }

  doRuntimeReplacement(): void {
    this.replacer(this.astService.stringLiteral(this.toValueForm()), false);
  }

  private toValueForm(): string {
    return `var(${this.varName})`;
  }
}
