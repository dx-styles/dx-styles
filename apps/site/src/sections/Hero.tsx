import { CodeBlock } from "../components/CodeBlock";
import { Pill } from "../components/Pill";
import { container } from "../styles/layout";
import {
  cta,
  ctaRow,
  heroAccent,
  heroEyebrow,
  heroGrid,
  heroLead,
  heroSection,
  heroStats,
  heroTitle,
  statBlock,
  statLabel,
  statValue,
} from "./Hero.styles";

const HERO_SNIPPET = `import { recipe } from "dx-styles";

export const button = recipe({
  base: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: "999px",
  },
  variants: {
    appearance: {
      primary: { backgroundColor: "var(--button-bg-primary)" },
      secondary: { backgroundColor: "var(--button-bg-secondary)" },
    },
    size: {
      sm: { minHeight: "28px", paddingInline: "10px" },
      md: { minHeight: "32px", paddingInline: "12px" },
    },
  },
  defaultVariants: { appearance: "primary", size: "md" },
});`;

export const Hero = (): JSX.Element => {
  return (
    <header className={heroSection} id="top">
      <div className={container}>
        <div className={heroGrid}>
          <div>
            <div className={heroEyebrow}>
              <Pill tone="accent">dx-styles</Pill>
              <Pill tone="success">zero runtime</Pill>
            </div>
            <h1 className={heroTitle}>
              CSS-in-TS that <span className={heroAccent}>compiles away</span>
            </h1>
            <p className={heroLead}>
              The styling foundation for design systems. Authoring stays in TypeScript. CSS is
              statically extracted at build time — no runtime renderer, no provider, no FOUC.
              Deterministic class names, theme contracts, and RTL on rails.
            </p>
            <div className={ctaRow}>
              <a
                className={cta({ intent: "primary" })}
                href="#get-started"
                aria-label="Get started with dx-styles"
              >
                Get started →
              </a>
              <a className={cta({ intent: "ghost" })} href="#api" aria-label="See the API">
                See the API
              </a>
            </div>
            <div className={heroStats}>
              <div className={statBlock}>
                <span className={statValue}>0kb</span>
                <span className={statLabel}>Style runtime</span>
              </div>
              <div className={statBlock}>
                <span className={statValue}>100%</span>
                <span className={statLabel}>Static extraction</span>
              </div>
              <div className={statBlock}>
                <span className={statValue}>Auto</span>
                <span className={statLabel}>RTL mirroring</span>
              </div>
            </div>
          </div>
          <div>
            <CodeBlock language="ts" filename="Button.tsx — inline or colocated">
              {HERO_SNIPPET}
            </CodeBlock>
          </div>
        </div>
      </div>
    </header>
  );
};
