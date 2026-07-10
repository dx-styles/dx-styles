import { CodeBlock } from "../components/CodeBlock";
import { Pill } from "../components/Pill";
import { container, eyebrow, section, sectionLead, sectionTitle } from "../styles/layout";
import {
  banner,
  bannerHead,
  bannerLead,
  bannerTitle,
  dxCard,
  grid,
} from "./DeveloperExperience.styles";

const explainOutput = `class    button_bhhycyd__appearance-primary
source   button/styles.ts:14:5
symbol   button · recipe()
variant  appearance="primary"
compose  ← focusRing.ts:7  (css)
         ← styles.ts:18    (recipe.base)
css
  background: var(--button-bg-primary);
  border-color: transparent;
  color: var(--button-fg-primary);`;

const diagnosticOutput = `warning  use logical "insetInlineEnd"
         instead of "right"
         so the rule follows document
         direction.

  Pipeline.tsx:78
  >  77 | position: "absolute",
     78 | right: "-14px",
        | ^^^^^`;

const typecheckOutput = `button({ size: "xl" });
//      ~~~~~~~~~~~~
//   Type '"xl"' is not assignable
//   to '"sm" | "md"'.

button({ tone: "danger" });
//       ~~~~
//   Property 'tone' does not exist
//   on type ButtonVariants.`;

const handlesOutput = `import {
  createRecipeStyleHandles,
  css,
} from "dx-styles";

import { button } from "./Button.styles";

const buttonHandles = createRecipeStyleHandles(button);

// Layer overrides on the public handle —
// no source fork, no specificity ladder.
export const compactButton = css(buttonHandles.root, {
  minHeight: "24px",
  paddingInline: "8px",
});`;

interface DxItem {
  readonly title: string;
  readonly description: string;
  readonly code: string;
  readonly filename: string;
  readonly language: string;
  readonly pill: string;
}

const items: readonly DxItem[] = [
  {
    title: "Explain any class — name to source.",
    description:
      "Resolve any emitted class back to its authoring file, recipe node, slot context, and composition edges. Open a CSS bug, run explain, jump straight to the source.",
    code: explainOutput,
    filename: "$ bun run explain button_bhhycyd__appearance-primary",
    language: "shell",
    pill: "explain tool",
  },
  {
    title: "Source-linked diagnostics at build time.",
    description:
      "Direction-aware authoring is enforced by the extractor: physical properties surface as warnings with the file, line, and column. No runtime check, no surprises in production.",
    code: diagnosticOutput,
    filename: "vite build",
    language: "shell",
    pill: "build-time",
  },
  {
    title: "Variant typos fail in the editor.",
    description:
      "Recipe and slotRecipe variant maps are inferred. Unknown variant axes or values surface in the editor before you ever save the file — no untyped string indices.",
    code: typecheckOutput,
    filename: "Button.tsx — typecheck",
    language: "ts",
    pill: "type-safe",
  },
  {
    title: "Extend recipes without forking.",
    description:
      "Component packages expose opaque StyleHandle values via createRecipeStyleHandles. Layer overrides on a recipe root or any slot through plain css() — no source fork, no specificity ladder, no provider in the tree.",
    code: handlesOutput,
    filename: "compactButton.ts",
    language: "ts",
    pill: "compose, don't fork",
  },
];

export const DeveloperExperience = (): JSX.Element => {
  return (
    <section className={section({ tone: "muted" })} id="dx">
      <div className={container}>
        <div className={eyebrow}>Developer experience</div>
        <h2 className={sectionTitle}>
          When the styling layer is honest, debugging is a grep away.
        </h2>
        <p className={sectionLead}>
          Static extraction makes the styling pipeline auditable. dx-styles ships first-class tooling
          so you can answer the questions that actually come up: where did this class come from, why
          is the variant name wrong, and what changed between builds.
        </p>
        <div className={grid}>
          {items.map((item) => {
            const slots = dxCard({});
            return (
              <article key={item.title} className={slots.root}>
                <div className={slots.header}>
                  <Pill tone="accent">{item.pill}</Pill>
                  <h3 className={slots.title}>{item.title}</h3>
                  <p className={slots.description}>{item.description}</p>
                </div>
                <div className={slots.code}>
                  <CodeBlock language={item.language} filename={item.filename} size="xs" wrap>
                    {item.code}
                  </CodeBlock>
                </div>
              </article>
            );
          })}
        </div>
        <div className={banner}>
          <div className={bannerHead}>
            <Pill tone="success">deterministic by design</Pill>
            <h3 className={bannerTitle}>
              Class names are stable. Diffs are reviewable. Snapshots survive refactors.
            </h3>
            <p className={bannerLead}>
              Same input, same hash. CSS diffs in code review reflect real authoring changes — not
              bundler order or runtime evaluation. Snapshot tests stop being a liability.
            </p>
          </div>
          <CodeBlock language="shell" filename="git diff dist/components/button.css" size="sm">
            {`- .button_bhhycyd__size-md { min-height: 32px; ... }
+ .button_bhhycyd__size-md { min-height: 32px; ...
+   padding-inline: var(--button-spacing-md); }`}
          </CodeBlock>
        </div>
      </div>
    </section>
  );
};
