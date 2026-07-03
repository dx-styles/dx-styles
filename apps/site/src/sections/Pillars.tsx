import { Card } from "../components/Card";
import { Pill } from "../components/Pill";
import { container, eyebrow, section, sectionLead, sectionTitle } from "../styles/layout";
import { grid, numberLabel } from "./Pillars.styles";

const pillars = [
  {
    number: "01",
    title: "Zero runtime.",
    pill: "no provider · no FOUC",
    description:
      "dx-styles is not a runtime renderer. CSS is emitted at build time and loaded as normal module-side artifacts. No React provider, no style collector, no flash of unstyled content.",
  },
  {
    number: "02",
    title: "Deterministic by design.",
    pill: "predictable hashes",
    description:
      "Class names are precompiled. The runtime selector only chooses among them. Identical inputs produce identical outputs across builds — no hash drift, no surprises in diffs.",
  },
  {
    number: "03",
    title: "RTL on rails.",
    pill: "compile-time mirroring",
    description:
      "Opt-in compile-time RTL overrides for conservative physical-side declarations. Authors keep writing LTR; extraction handles the mirrored side. ESLint enforces RTL-friendly authoring.",
  },
] as const;

export const Pillars = (): JSX.Element => {
  return (
    <section className={section({ tone: "muted" })} id="why">
      <div className={container}>
        <div className={eyebrow}>Why dx-styles</div>
        <h2 className={sectionTitle}>Three guarantees you can build a design system on.</h2>
        <p className={sectionLead}>
          A small authoring surface, an aggressive build-time pipeline, and a framework-agnostic
          runtime. Designed to scale with vNext without shipping a single byte of styling code to
          the browser.
        </p>
        <div className={grid}>
          {pillars.map((pillar) => (
            <Card
              key={pillar.number}
              eyebrow={
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span className={numberLabel}>{pillar.number}</span>
                  <Pill tone="accent">{pillar.pill}</Pill>
                </div>
              }
              title={pillar.title}
              description={pillar.description}
              emphasis="raised"
            />
          ))}
        </div>
      </div>
    </section>
  );
};
