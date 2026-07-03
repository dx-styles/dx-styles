import { Pill } from "../components/Pill";
import { container, eyebrow, section, sectionLead, sectionTitle } from "../styles/layout";
import {
  arrow,
  flow,
  promise,
  promiseText,
  stage,
  stageBody,
  stageHint,
  stageStep,
  stageTitle,
} from "./Pipeline.styles";

export const Pipeline = (): JSX.Element => {
  return (
    <section className={section({ tone: "base" })} id="pipeline">
      <div className={container}>
        <div className={eyebrow}>How it works</div>
        <h2 className={sectionTitle}>What you author is exactly what ships.</h2>
        <p className={sectionLead}>
          A small build-time pipeline turns tagged calls into deterministic class names and CSS
          sidecars. The runtime only chooses between precompiled classes — no string concatenation
          at runtime, no style object serialization.
        </p>
        <div className={flow}>
          <div className={stage({ tone: "input" })}>
            <span className={stageStep}>Step 1 · author</span>
            <h3 className={stageTitle}>Tagged calls in TS/TSX</h3>
            <p className={stageBody}>
              Type-safe authoring with <code>recipe()</code>, <code>slotRecipe()</code>,
              <code> css()</code>. Keep them inline next to a component, or split into a colocated{" "}
              <code>*.styles.ts</code> — the extractor treats both the same.
            </p>
            <span className={stageHint}>recipe(...) · slotRecipe(...) · css(...)</span>
            <span className={arrow} aria-hidden="true">
              →
            </span>
          </div>
          <div className={stage({ tone: "transform" })}>
            <span className={stageStep}>Step 2 · extract</span>
            <h3 className={stageTitle}>WyW-in-JS transform</h3>
            <p className={stageBody}>
              Tagged calls are evaluated at build time. Variant matrices compile to deterministic
              class groups; RTL-flippable rules emit their mirrored sibling.
            </p>
            <span className={stageHint}>processors/recipe.cts</span>
            <span className={arrow} aria-hidden="true">
              →
            </span>
          </div>
          <div className={stage({ tone: "output" })}>
            <span className={stageStep}>Step 3 · ship</span>
            <h3 className={stageTitle}>*.css sidecars</h3>
            <p className={stageBody}>
              Built modules import generated CSS through the normal module graph. Bundler
              tree-shakes unused selectors. Runtime cost is a single <code>cx()</code> call.
            </p>
            <span className={stageHint}>sideEffects: [&quot;**/*.css&quot;]</span>
          </div>
        </div>
        <div className={promise}>
          <span className={promiseText}>
            No runtime renderer. No provider. No hydration mismatch surface.
          </span>
          <Pill tone="success">framework-agnostic</Pill>
        </div>
      </div>
    </section>
  );
};
